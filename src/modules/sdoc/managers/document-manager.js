import fs from 'fs';
import { v4, v5 } from "uuid";
import deepCopy from 'deep-copy';
import { SAVE_INTERVAL, SEAHUB_SERVER } from "../../../config/config";
import logger from "../../../loggers";
import { deleteDir, getErrorMessage, errorHandle } from "../../../utils";
import seaServerAPI from "../api/sea-server-api";
import { DOC_CACHE_TIME } from '../constants';
import Document from '../models/document';
import { generateDefaultDocContent, isSdocContentValid, normalizeChildren } from '../models/document-utils';
import { applyOperations } from '../utils/slate-utils';
import { listPendingOperationsByDoc } from '../dao/operation-log';
import {
  getReviewApplyRegistration, createReviewApplyRegistration,
  listPendingReviewSaveRegistrations, markReviewApplyPersistence,
  listPendingReviewSaveDocUuids,
} from '../dao/review-apply';
import OperationsManager from './operations-manager';
import UsersManager from './users-manager';
import IOHelper from '../wio/io-helper';
import { buildDocumentContext } from '../utils/agent-context';
import { applyPayloadDigest, selectionDigest, setBlockTypeHash, setListTypeHash, CanonicalizationError } from '../utils/sdoc-canonical';
import { withTransaction } from '../../../db-helper';

const REVIEW_BLOCK_TYPES = new Set([
  'title', 'subtitle', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6', 'paragraph', 'table_cell',
]);
const REVIEW_SAVE_RESULT_RETRY_INITIAL_DELAY = 5000;
const REVIEW_SAVE_RESULT_RETRY_MAX_DELAY = 60000;
const APPLY_REGISTRATION_LIMIT = 1000;

const resolveLeafPath = (elements, blockId, textNodeId) => {
  let result = null;

  const visit = (node, path, block) => {
    if (result || !node) return;
    if (node.id === textNodeId && typeof node.text === 'string') {
      if (block && block.id === blockId) {
        result = {path};
      }
      return;
    }
    if (!Array.isArray(node.children)) return;
    const nextBlock = REVIEW_BLOCK_TYPES.has(node.type) ? node : block;
    node.children.forEach((child, index) => visit(child, path.concat(index), nextBlock));
  };

  elements.forEach((element, index) => visit(element, [index], null));
  return result;
};

const buildApplyResult = (params, approvedBy, partial) => {
  return {
    schema_version: 'sdoc-apply-result/v1',
    apply_attempt_id: params.apply_attempt_id,
    task_id: params.task_id,
    review_decision_id: params.review_decision_id,
    snapshot_id: params.snapshot_id,
    document_incarnation: params.document_incarnation,
    file_uuid: params.file_uuid,
    doc_uuid: params.doc_uuid,
    changeset_revision_id: params.changeset_revision_id,
    changeset_revision: params.changeset_revision,
    card_revision: params.card_revision,
    decision_kind: params.decision_kind,
    selection_digest: params.selection_digest,
    apply_payload_digest: params.apply_payload_digest,
    approved_by: approvedBy,
    status: partial.status,
    conflicts: partial.conflicts || [],
    applied_sdoc_version: partial.applied_sdoc_version ?? null,
    operation_log_correlation_id: partial.operation_log_correlation_id ?? null,
    persistence_status: partial.persistence_status || 'not_requested',
    error_code: partial.error_code || null,
  };
};

class DocumentManager {

  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();
    this.docLoadPromises = new Map();
    this.docWriteQueues = new Map();
    this.reviewSaveTasks = new Map();
    this.reviewSaveRetryStates = new Map();
    this.applyRegistrations = new Map();

    // save infos
    this.isSaving = false;
    this.lastSavingInfo = {};
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DocumentManager();
    return this.instance;
  };

  startSaveTimer = () => {
    this.recoverReviewSaveResults().catch(error => logger.error('Recover SDoc review save results failed:', error.message));
    this.saveTimer = setInterval(() => {
      this.saveAllDocs();
      this.recoverReviewSaveResults().catch(error => logger.error('Recover SDoc review save results failed:', error.message));
    }, SAVE_INTERVAL);

    process.on('SIGTERM', () => {
      logger.info('Exiting server process:', process.pid);
      this.saveAllDocs();
      setInterval(() => {
        clearInterval(this.saveTimer);
        process.kill(process.pid, 'SIGKILL');
      }, SAVE_INTERVAL);
    });
  };

  saveAllDocs = async () => {
    if (this.isSaving) {
      logger.info('Last save task not completed.');
      return;
    }

    this.isSaving = true;

    let savedDocs = [];
    let unsavedDocs = [];
    const startTime = Date.now();
    const docUuids = this.documents.keys();
    for (let docUuid of docUuids) {
      // Save document
      const saveFlag = await this.saveDoc(docUuid);
      if (saveFlag) {
        savedDocs.push(docUuid);
      } else {
        unsavedDocs.push(docUuid);
      }
    }
    // record saving message
    const count = savedDocs.length;
    logger.info(`${count} docs saved.`);

    this.isSaving = false;
    this.lastSavingInfo.count = count;
    this.lastSavingInfo.startTime = startTime;
    this.lastSavingInfo.endTime = Date.now();

    await this.removeDocsWithNoAccess(unsavedDocs);
  };

  recoverReviewSaveResults = async () => {
    const docUuids = await listPendingReviewSaveDocUuids();
    for (const docUuid of docUuids) {
      try {
        const result = await seaServerAPI.getDocContent(docUuid);
        const savedVersion = result && result.data && result.data.version;
        if (typeof savedVersion === 'number') {
          await this.sendReviewSaveResults(docUuid, savedVersion, 'persisted');
        }
      } catch (error) {
        const message = getErrorMessage(error);
        if (message && message.status === 404) {
          await this.sendReviewSaveResults(docUuid, 0, 'file_unavailable');
        } else {
          logger.error('Recover SDoc review save result failed:', error.message);
        }
      }
    }
  };

  reloadDoc = async (docUuid, docName) => {
    return this.enqueueDocWrite(docUuid, () => this.reloadDocUnsafe(docUuid, docName));
  };

  reloadDocUnsafe = async (docUuid, docName) => {
    const loading = this.docLoadPromises.get(docUuid);
    if (loading) {
      return loading;
    }

    // Publish the reload promise before removing the cached document. A
    // concurrent getDoc() then joins this reload instead of loading an older
    // snapshot in parallel and later replacing the post-Apply document.
    const reloadPromise = (async () => {
      await this.removeDocFromMemoryUnsafe(docUuid);
      // Reuse the ordinary load path so committed operation-log rows are
      // replayed before the replacement snapshot becomes visible in memory.
      return this.loadDoc(docUuid, docName, docName);
    })();
    this.docLoadPromises.set(docUuid, reloadPromise);
    try {
      return await reloadPromise;
    } finally {
      if (this.docLoadPromises.get(docUuid) === reloadPromise) {
        this.docLoadPromises.delete(docUuid);
      }
    }
  };

  getDoc = async (docUuid, docName, docTitle, username) => {
    const document = this.documents.get(docUuid);
    if (document) {
      return document.toJson();
    }

    const loading = this.docLoadPromises.get(docUuid);
    if (loading) {
      return loading;
    }

    const loadPromise = this.loadDoc(docUuid, docName, docTitle, username);
    this.docLoadPromises.set(docUuid, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (this.docLoadPromises.get(docUuid) === loadPromise) {
        this.docLoadPromises.delete(docUuid);
      }
    }
  };

  loadDoc = async (docUuid, docName, docTitle, username) => {
    let result = null;
    try {
      result = await seaServerAPI.getDocContent(docUuid);
    } catch (err) {
      errorHandle(err);
      const error = new Error('The content of the document loaded error');
      error.error_type = 'content_load_invalid';
      error.from_url = `${SEAHUB_SERVER}/api/v2.1/seadoc/content/${docUuid}/`;
      throw error;
    }

    const docContent = result.data ? result.data : generateDefaultDocContent(docTitle, username);
    if (!isSdocContentValid(docContent)) {
      const error = new Error('The content of the document does not conform to the sdoc specification');
      error.error_type = 'content_invalid';
      throw error;

    }
    const doc = new Document(docUuid, docName, docContent);
    const persistedVersion = doc.version;

    // apply pending operations
    const results = await listPendingOperationsByDoc(docUuid, doc.version);
    if (results.length) {
      logger.info(`doc ${docName}(${docUuid}) re-execute ${results.length} pending operations`);
      this.applyPendingOperations(doc, results);
    }

    this.documents.set(docUuid, doc);
    this.sendReviewSaveResults(docUuid, persistedVersion, 'persisted')
      .catch(error => logger.error('Recover SDoc review save result failed:', error.message));
    // save doc when content is empty
    if (!result.data) {
      doc.setMeta({need_save: true});
      await this.saveDocUnsafe(docUuid);
    }
    return doc.toJson();
  };

  saveDoc = async (docUuid) => {
    return this.enqueueDocWrite(docUuid, () => this.saveDocUnsafe(docUuid));
  };

  saveDocUnsafe = async (docUuid) => {
    const document = this.documents.get(docUuid);
    // The save function is an asynchronous function, which does not affect the normal execution of other programs,
    // and there is a possibility that the file has been deleted when the next file is saved
    if (!document) {
      logger.info(`SDoc ${docUuid} has been removed from memory`);
      return Promise.resolve(false);
    }
    const meta = document.getMeta();
    if (meta.is_saving || !meta.need_save) { // is saving
      return Promise.resolve(false);
    }

    document.setMeta({is_saving: true});

    // Get save info
    const { version: savingVersion, format_version, elements, docName, last_modify_user = '' } = document;
    const docContent = { version: savingVersion, format_version, elements, last_modify_user };

    let saveFlag = false;
    let saveErrorMessage = null;
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(docContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveDocContent(docUuid, {path: tempPath}, docContent.last_modify_user);
      saveFlag = true;
      logger.info(`${docName}(${docUuid}) saved`);
      await this.sendReviewSaveResults(docUuid, savingVersion, 'persisted');
    } catch(err) {
      saveFlag = false;
      const message = getErrorMessage(err);
      saveErrorMessage = message;
      if (message.status && message.status === 404) {
        logger.info(`${docName}(${docUuid}) save failed`);
        logger.info(JSON.stringify(message));
        await this.sendReviewSaveResults(docUuid, savingVersion, 'file_unavailable');
        await this.removeDocFromMemoryUnsafe(docUuid);
      } else {
        logger.error(`${docName}(${docUuid}) save failed`);
        logger.error(JSON.stringify(message));
        await this.sendReviewSaveResults(docUuid, savingVersion, 'save_pending');
      }
    } finally {
      deleteDir(tempPath);
    }

    const needSave = saveFlag ? document.version !== savingVersion : !(saveErrorMessage && saveErrorMessage.status === 404);
    document.setMeta({is_saving: false, need_save: needSave});
    return Promise.resolve(saveFlag);
  };

  enqueueDocWrite = (docUuid, callback) => {
    const previous = this.docWriteQueues.get(docUuid) || Promise.resolve();
    const next = previous.catch(() => {}).then(callback);
    const tracked = next.finally(() => {
      if (this.docWriteQueues.get(docUuid) === tracked) {
        this.docWriteQueues.delete(docUuid);
      }
    });
    this.docWriteQueues.set(docUuid, tracked);
    return next;
  };

  registerReviewSaveTask = (docUuid, task) => {
    const tasks = this.reviewSaveTasks.get(docUuid) || [];
    if (!tasks.some(item => item.applyAttemptId === task.applyAttemptId && item.appliedVersion === task.appliedVersion)) {
      tasks.push(task);
      this.reviewSaveTasks.set(docUuid, tasks);
    }
  };

  clearReviewSaveResultRetry = (docUuid) => {
    const state = this.reviewSaveRetryStates.get(docUuid);
    if (state && state.timer) {
      clearTimeout(state.timer);
    }
    this.reviewSaveRetryStates.delete(docUuid);
  };

  scheduleReviewSaveResultRetry = (docUuid, savedVersion, outcome) => {
    const previous = this.reviewSaveRetryStates.get(docUuid);
    const delay = previous
      ? Math.min(previous.delay * 2, REVIEW_SAVE_RESULT_RETRY_MAX_DELAY)
      : REVIEW_SAVE_RESULT_RETRY_INITIAL_DELAY;
    if (previous && previous.timer) {
      clearTimeout(previous.timer);
    }
    const timer = setTimeout(() => {
      this.reviewSaveRetryStates.set(docUuid, {...this.reviewSaveRetryStates.get(docUuid), timer: null});
      this.sendReviewSaveResults(docUuid, savedVersion, outcome, true)
        .catch(error => logger.error('Retry SDoc review save result failed:', error.message));
    }, delay);
    this.reviewSaveRetryStates.set(docUuid, {timer, delay, savedVersion, outcome});
  };

  sendReviewSaveResults = async (docUuid, savedVersion, outcome, isRetry = false) => {
    if (!isRetry) {
      this.clearReviewSaveResultRetry(docUuid);
    }
    let persistedRegistrations = [];
    try {
      persistedRegistrations = await listPendingReviewSaveRegistrations(
        docUuid, outcome === 'persisted' ? savedVersion : null);
    } catch (error) {
      logger.error('Load pending SDoc review save results failed:', error.message);
    }
    const taskByAttemptId = new Map();
    for (const task of this.reviewSaveTasks.get(docUuid) || []) {
      taskByAttemptId.set(task.applyAttemptId, task);
    }
    for (const registration of persistedRegistrations) {
      const result = registration.result || {};
      taskByAttemptId.set(registration.apply_attempt_id, {
        applyAttemptId: registration.apply_attempt_id,
        operationLogCorrelationId: result.operation_log_correlation_id,
        documentIncarnation: result.document_incarnation,
        appliedVersion: registration.applied_sdoc_version,
        approvedBy: result.approved_by,
      });
    }
    const tasks = Array.from(taskByAttemptId.values());
    const remaining = [];
    let deliveryFailed = false;
    for (const task of tasks) {
      if (outcome === 'persisted' && task.appliedVersion > savedVersion) {
        remaining.push(task);
        continue;
      }
      try {
        await seaServerAPI.sendReviewSaveResult({
          docUuid,
          applyAttemptId: task.applyAttemptId,
          operationLogCorrelationId: task.operationLogCorrelationId,
          documentIncarnation: task.documentIncarnation,
          appliedVersion: task.appliedVersion,
          approvedBy: task.approvedBy,
          outcome,
          savedVersion,
        });
        if (outcome === 'persisted') {
          await markReviewApplyPersistence(task.applyAttemptId, 'persisted');
        } else if (outcome === 'file_unavailable') {
          await markReviewApplyPersistence(task.applyAttemptId, 'file_unavailable');
        }
        if (outcome === 'save_pending') {
          remaining.push(task);
        }
      } catch (error) {
        logger.error('Send SDoc review save result failed:', error.message);
        remaining.push(task);
        deliveryFailed = true;
      }
    }
    if (remaining.length) {
      this.reviewSaveTasks.set(docUuid, remaining);
    } else {
      this.reviewSaveTasks.delete(docUuid);
    }
    // A successful file upload must not depend on need_save remaining true in
    // order to deliver its Review result. Retry the callback independently.
    // This intentionally provides process-local recovery only.
    if (deliveryFailed && outcome !== 'save_pending') {
      this.scheduleReviewSaveResultRetry(docUuid, savedVersion, outcome);
    } else {
      this.clearReviewSaveResultRetry(docUuid);
    }
  };

  setApplyRegistration = (applyAttemptId, registration) => {
    if (!this.applyRegistrations.has(applyAttemptId)
        && this.applyRegistrations.size >= APPLY_REGISTRATION_LIMIT) {
      for (const [registeredAttemptId, registered] of this.applyRegistrations) {
        if (this.applyRegistrations.size < APPLY_REGISTRATION_LIMIT) {
          break;
        }
        if (registered.status !== 'committing') {
          this.applyRegistrations.delete(registeredAttemptId);
        }
      }
    }
    this.applyRegistrations.set(applyAttemptId, registration);
  };

  getPersistedApplyResult = async (docUuid, params, approvedBy) => {
    const registration = await getReviewApplyRegistration(params.apply_attempt_id);
    if (!registration) return null;
    if (registration.doc_uuid !== docUuid || registration.apply_payload_digest !== params.apply_payload_digest) {
      return buildApplyResult(params, approvedBy, {
        status: 'failed_precommit', error_code: 'invalid_selection_payload',
      });
    }
    this.setApplyRegistration(params.apply_attempt_id, {
      status: registration.status,
      result: registration.result,
    });
    return registration.result;
  };

  persistApplyResult = async (docUuid, params, result) => {
    try {
      await createReviewApplyRegistration({
        applyAttemptId: params.apply_attempt_id,
        docUuid,
        applyPayloadDigest: params.apply_payload_digest,
        status: result.status,
        result,
      });
    } catch (error) {
      const existing = await getReviewApplyRegistration(params.apply_attempt_id);
      if (!existing) throw error;
      if (existing.doc_uuid !== docUuid || existing.apply_payload_digest !== params.apply_payload_digest) {
        throw error;
      }
      this.setApplyRegistration(params.apply_attempt_id, {
        status: existing.status,
        result: existing.result,
      });
      return existing.result;
    }
    this.setApplyRegistration(params.apply_attempt_id, {status: result.status, result});
    return result;
  };

  applyReviewChangeSet = async (docUuid, docName, params, approvedBy) => {
    return this.enqueueDocWrite(docUuid, async () => {
      // Recompute both digests before preflight; mismatch is fail-closed.
      try {
        const computedSelection = selectionDigest({
          taskId: params.task_id,
          cardRevision: params.card_revision,
          changesetRevision: params.changeset_revision,
          decisionKind: params.decision_kind,
          selectedChangeItemIds: params.selected_change_item_ids,
        });
        if (computedSelection !== params.selection_digest) {
          return buildApplyResult(params, approvedBy, {status: 'failed_precommit', error_code: 'invalid_selection_payload'});
        }
        const computedPayload = applyPayloadDigest({
          taskId: params.task_id,
          reviewDecisionId: params.review_decision_id,
          cardRevision: params.card_revision,
          changesetRevisionId: params.changeset_revision_id,
          changesetRevision: params.changeset_revision,
          selectionDigestValue: params.selection_digest,
          selectedItems: params.selected_items,
        });
        if (computedPayload !== params.apply_payload_digest) {
          return buildApplyResult(params, approvedBy, {status: 'failed_precommit', error_code: 'invalid_selection_payload'});
        }
      } catch (error) {
        if (error instanceof CanonicalizationError) {
          return buildApplyResult(params, approvedBy, {status: 'failed_precommit', error_code: 'invalid_selection_payload'});
        }
        throw error;
      }

      const persistedResult = await this.getPersistedApplyResult(docUuid, params, approvedBy);
      if (persistedResult) return persistedResult;

      let document = this.documents.get(docUuid);
      if (!document) {
        await this.getDoc(docUuid, docName);
        document = this.documents.get(docUuid);
      }
      if (!document) {
        const result = buildApplyResult(params, approvedBy, {status: 'failed_precommit', error_code: 'document_unavailable'});
        return this.persistApplyResult(docUuid, params, result);
      }

      const existing = this.applyRegistrations.get(params.apply_attempt_id);
      if (existing) {
        return existing.result;
      }

      if (document.document_incarnation !== params.document_incarnation) {
        const result = buildApplyResult(params, approvedBy, {
          status: 'preflight_conflicted',
          conflicts: [{item_id: null, conflict_code: 'document_incarnation_changed'}],
        });
        return this.persistApplyResult(docUuid, params, result);
      }

      // Resolve each selected item against the current document projection.
      const projection = buildDocumentContext({
        elements: document.elements,
        version: document.version,
        fileUuid: docUuid,
        documentIncarnation: document.document_incarnation,
        snapshotId: params.snapshot_id,
      });
      const blockById = new Map(projection.blocks.map(block => [block.block_id, block]));
      const listById = new Map((projection.lists || []).map(list => [list.block_id, list]));

      const conflicts = [];
      const operations = [];
      for (const item of params.selected_items) {
        const target = item.target || {};
        const precondition = item.precondition || {};

        if (item.kind === 'set_list_type') {
          const listNode = listById.get(target.block_id);
          const blockIndex = document.elements.findIndex(el => el && el.id === target.block_id);
          if (!listNode || blockIndex < 0) {
            conflicts.push({item_id: item.item_id, conflict_code: 'target_not_found'});
            continue;
          }
          if (listNode.type !== target.block_type) {
            conflicts.push({item_id: item.item_id, conflict_code: 'block_type_mismatch'});
            continue;
          }
          if (JSON.stringify(listNode.ancestor_path) !== JSON.stringify(target.ancestor_path)) {
            conflicts.push({item_id: item.item_id, conflict_code: 'ancestor_path_mismatch'});
            continue;
          }
          let currentHash;
          try {
            currentHash = setListTypeHash({
              blockId: target.block_id,
              blockType: listNode.type,
              ancestorPath: listNode.ancestor_path,
              fileUuid: docUuid,
              documentIncarnation: document.document_incarnation,
            });
          } catch (error) {
            if (!(error instanceof CanonicalizationError)) throw error;
            conflicts.push({item_id: item.item_id, conflict_code: 'before_hash_mismatch'});
            continue;
          }
          if (currentHash !== precondition.canonical_before_hash) {
            conflicts.push({item_id: item.item_id, conflict_code: 'before_hash_mismatch'});
            continue;
          }
          operations.push({
            type: 'set_node',
            path: [blockIndex],
            node_id: target.block_id,
            properties: {type: listNode.type},
            newProperties: {type: item.after_type},
          });
          continue;
        }

        const block = blockById.get(target.block_id);
        if (!block || !block.supported) {
          conflicts.push({item_id: item.item_id, conflict_code: 'target_not_found'});
          continue;
        }

        if (item.kind === 'set_block_type') {
          const blockIndex = document.elements.findIndex(el => el && el.id === target.block_id);
          if (blockIndex < 0) {
            conflicts.push({item_id: item.item_id, conflict_code: 'target_not_found'});
            continue;
          }
          if (block.type !== target.block_type) {
            conflicts.push({item_id: item.item_id, conflict_code: 'block_type_mismatch'});
            continue;
          }
          if (JSON.stringify(block.ancestor_path) !== JSON.stringify(target.ancestor_path)) {
            conflicts.push({item_id: item.item_id, conflict_code: 'ancestor_path_mismatch'});
            continue;
          }
          let currentHash;
          try {
            currentHash = setBlockTypeHash({
              blockId: target.block_id,
              blockType: block.type,
              ancestorPath: block.ancestor_path,
              beforeLeafText: block.before_leaf_text,
              fileUuid: docUuid,
              documentIncarnation: document.document_incarnation,
            });
          } catch (error) {
            if (!(error instanceof CanonicalizationError)) throw error;
            conflicts.push({item_id: item.item_id, conflict_code: 'before_hash_mismatch'});
            continue;
          }
          if (currentHash !== precondition.canonical_before_hash) {
            conflicts.push({item_id: item.item_id, conflict_code: 'before_hash_mismatch'});
            continue;
          }
          operations.push({
            type: 'set_node',
            path: [blockIndex],
            node_id: target.block_id,
            properties: {type: block.type},
            newProperties: {type: item.after_type},
          });
          continue;
        }

        if (block.text_node_id !== target.text_node_id) {
          conflicts.push({item_id: item.item_id, conflict_code: 'target_not_found'});
          continue;
        }
        if (block.type !== target.block_type) {
          conflicts.push({item_id: item.item_id, conflict_code: 'block_type_mismatch'});
          continue;
        }
        if (JSON.stringify(block.ancestor_path) !== JSON.stringify(target.ancestor_path)) {
          conflicts.push({item_id: item.item_id, conflict_code: 'ancestor_path_mismatch'});
          continue;
        }
        if (block.canonical_before_hash !== precondition.canonical_before_hash || block.before_leaf_text !== precondition.before_leaf_text) {
          conflicts.push({item_id: item.item_id, conflict_code: 'before_hash_mismatch'});
          continue;
        }
        const resolved = resolveLeafPath(document.elements, target.block_id, target.text_node_id);
        if (!resolved) {
          conflicts.push({item_id: item.item_id, conflict_code: 'target_not_found'});
          continue;
        }
        operations.push(
          {type: 'remove_text', path: resolved.path, node_id: target.text_node_id, offset: 0, text: precondition.before_leaf_text},
          {type: 'insert_text', path: resolved.path, node_id: target.text_node_id, offset: 0, text: item.after_text},
        );
      }

      if (conflicts.length) {
        const result = buildApplyResult(params, approvedBy, {status: 'preflight_conflicted', conflicts});
        return this.persistApplyResult(docUuid, params, result);
      }

      const draft = new Document(docUuid, docName, {
        version: document.version,
        format_version: document.format_version,
        elements: deepCopy(document.elements),
        last_modify_user: document.last_modify_user,
      });
      if (!applyOperations(draft, deepCopy(operations), {username: approvedBy})) {
        const result = buildApplyResult(params, approvedBy, {status: 'failed_precommit', error_code: 'preflight_validation_failed'});
        return this.persistApplyResult(docUuid, params, result);
      }

      // The queue serializes normal unload/reload paths. Keep a final identity
      // fence immediately before the durable commit so a future caller cannot
      // accidentally commit against a document that is no longer active.
      if (this.documents.get(docUuid) !== document
          || document.document_incarnation !== params.document_incarnation) {
        const result = buildApplyResult(params, approvedBy, {
          status: 'preflight_conflicted',
          conflicts: [{item_id: null, conflict_code: 'document_incarnation_changed'}],
        });
        return this.persistApplyResult(docUuid, params, result);
      }

      this.setApplyRegistration(params.apply_attempt_id, {
        status: 'committing',
        result: buildApplyResult(params, approvedBy, {status: 'in_progress'}),
      });

      const result = buildApplyResult(params, approvedBy, {
        status: 'applied',
        applied_sdoc_version: draft.version,
        operation_log_correlation_id: params.apply_attempt_id,
        persistence_status: 'not_requested',
      });
      const operationsManager = OperationsManager.getInstance();
      try {
        await withTransaction(async (executor) => {
          await createReviewApplyRegistration({
            applyAttemptId: params.apply_attempt_id,
            docUuid,
            applyPayloadDigest: params.apply_payload_digest,
            status: result.status,
            result,
          }, executor);
          await operationsManager.addOperations(docUuid, operations, draft.version, {username: approvedBy}, {
            executor,
            deferCache: true,
          });
        });
        operationsManager.addOperationsToCache(docUuid, operations, draft.version);
      } catch (error) {
        const existingResult = await this.getPersistedApplyResult(docUuid, params, approvedBy);
        if (existingResult) return existingResult;
        logger.error('Save review operations failed:', error);
        const failedResult = buildApplyResult(params, approvedBy, {
          status: 'failed_precommit', error_code: 'operation_log_failed',
        });
        return this.persistApplyResult(docUuid, params, failedResult);
      }

      document.elements = draft.elements;
      document.version = draft.version;
      document.last_modify_user = draft.last_modify_user;
      document.setMeta({need_save: true});
      this.registerReviewSaveTask(docUuid, {
        applyAttemptId: params.apply_attempt_id,
        operationLogCorrelationId: params.apply_attempt_id,
        appliedVersion: draft.version,
        documentIncarnation: params.document_incarnation,
        approvedBy,
      });
      IOHelper.getInstance().sendDocumentUpdateToRoom(docUuid, {
        operations,
        version: draft.version,
        user: {username: approvedBy},
        selection: null,
        cursor_data: null,
      });
      this.saveDoc(docUuid).catch(error => logger.error('Save reviewed document failed:', error));

      this.setApplyRegistration(params.apply_attempt_id, {status: 'applied', result});
      return result;
    });
  };

  getApplyResult = async (docUuid, applyAttemptId) => {
    return this.enqueueDocWrite(docUuid, async () => {
      const persisted = await getReviewApplyRegistration(applyAttemptId);
      if (persisted && persisted.doc_uuid === docUuid) {
        this.setApplyRegistration(applyAttemptId, {status: persisted.status, result: persisted.result});
        return persisted.result;
      }
      const registration = this.applyRegistrations.get(applyAttemptId);
      if (!registration) {
        return {error_code: 'attempt_not_found'};
      }
      return registration.result;
    });
  };

  buildReviewSnapshot = async (docUuid, docName, fileUuid, docTitle, username) => {
    return this.enqueueDocWrite(docUuid, async () => {
      await this.getDoc(docUuid, docName, docTitle, username);
      const document = this.documents.get(docUuid);
      if (!document) {
        throw new Error('load_document_content_error');
      }
      const snapshotId = v5(
        `${fileUuid}:${document.document_incarnation}:${document.version}`,
        v5.URL,
      );
      const projection = buildDocumentContext({
        elements: document.elements,
        version: document.version,
        fileUuid,
        documentIncarnation: document.document_incarnation,
        snapshotId,
      });
      return projection;
    });
  };

  removeDoc = async (docUuid) => {
    return this.enqueueDocWrite(docUuid, () => this.removeDocFromMemoryUnsafe(docUuid));
  };

  // Compatibility entry point for callers that previously bypassed the
  // per-document queue. All public removals are now serialized with Apply.
  removeDocFromMemory = async (docUuid) => {
    return this.removeDoc(docUuid);
  };

  removeDocFromMemoryUnsafe = async (docUuid) => {
    this.docLoadPromises.delete(docUuid);
    if (this.documents.has(docUuid)) {
      logger.info('Removed doc ', docUuid, ' from memory');
      const operationsManager = OperationsManager.getInstance();
      operationsManager.clearOperations(docUuid);
      this.documents.delete(docUuid);
    }
    return Promise.resolve(true);
  };

  isDocInMemory = (docUuid) => {
    return this.documents.has(docUuid);
  };

  async removeDocs(docUuids) {
    await Promise.all(docUuids.map(docUuid => this.removeDoc(docUuid)));
  }

  async removeDocsWithNoAccess(docUuids) {
    for (const docUuid of docUuids) {
      await this.enqueueDocWrite(docUuid, async () => {
        // Re-evaluate access after earlier writes complete; a collaborator may
        // have reopened the document while cache cleanup was waiting.
        const users = UsersManager.getInstance().getDocUsers(docUuid);
        const document = this.documents.get(docUuid);
        if (users.length > 0 || !document) {
          return;
        }
        const meta = document.getMeta();
        if (Date.now() - meta.last_access > DOC_CACHE_TIME) {
          await this.removeDocFromMemoryUnsafe(docUuid);
          logger.info(`Regularly clear files that no one has accessed: ${docUuid}`);
        }
      });
    }
  }

  normalizeSdoc = (docUuid) => {
    const document = this.documents.get(docUuid);
    document.elements = normalizeChildren(document.elements);
  };

  execOperationsBySocket = async (params, docName) => {
    return this.enqueueDocWrite(params.doc_uuid, () => this.execOperationsBySocketUnsafe(params, docName));
  };

  execOperationsBySocketUnsafe = async (params, docName) => {
    const { doc_uuid, version: clientVersion, operations, user } = params;

    let document = this.documents.get(doc_uuid);
    if (!document) {
      try {
        // Load the document before executing op to avoid the document not being loaded into the memory after disconnection and reconnection
        await this.getDoc(doc_uuid, docName);
        document = this.documents.get(doc_uuid);
      } catch(e) {
        logger.error(`SOCKET_MESSAGE: Load ${docName}(${doc_uuid}) doc content error`);
        const result = {
          success: false,
          error_type: 'load_document_content_error',
        };
        return Promise.resolve(result);
      }
    }

    const { version: serverVersion } = document;
    if (serverVersion !== clientVersion) {
      const operationsManager = OperationsManager.getInstance();
      const loseOperations = await operationsManager.getLoseOperationList(doc_uuid, clientVersion);
      const result = {
        success: false,
        error_type: 'version_behind_server',
        lose_operations: loseOperations,
      };
      logger.warn('Version do not match: clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
      logger.warn('apply operations failed: sdoc uuid is %s, modified user is %s, execute operations %o', document.docUuid, user.username, operations);
      return Promise.resolve(result);
    }

    // execute operations success
    let isExecuteSuccess = false;
    try {
      // Prevent copying of references
      const dupOperations = deepCopy(operations);
      isExecuteSuccess = applyOperations(document, dupOperations, user);
    } catch (e) {
      logger.error('apply operations failed.', document.docUuid, operations);
      isExecuteSuccess = false;
    }

    // execute operations failed
    if (!isExecuteSuccess) {
      const result = {
        success: false,
        error_type: 'execute_client_operations_error',
      };
      return Promise.resolve(result);
    }

    if (isExecuteSuccess) {
      try {
        const operationsManager = OperationsManager.getInstance();
        await operationsManager.addOperations(doc_uuid, operations, document.version, user);
      } catch(e) {
        logger.error('Save operations to database error:', document.docUuid, operations);
        const result = {
          success: false,
          error_type: 'save_operations_to_database_error',
        };
        return Promise.resolve(result);
      }
    }

    // execute operations success
    const result = {
      success: true,
      version: document.version,
    };
    return Promise.resolve(result);

  };

  applyPendingOperations = (document, results) => {
    for (let result of results) {
      let operations = result.operations;
      operations = JSON.parse(operations);
      const version = result.op_id;
      const user = { username: result.author };
      let isExecuteSuccess = false;
      try {
        isExecuteSuccess = applyOperations(document, operations, user);
      } catch (e) {
        logger.error('apply pending operations failed.', document.docUuid, version, operations);
        isExecuteSuccess = false;
      }

      if (isExecuteSuccess) {
        document.version = version;
        document.meta.need_save = true;
      }
    }
  };

  setCursorLocation = (params) => {
    const { doc_uuid, user, location, cursor_data } = params;

    // sync document's cursors
    const document = this.documents.get(doc_uuid);
    document && document.setCursor(user, location, cursor_data);
  };

  deleteCursor = (docUuid, user) => {
    const document = this.documents.get(docUuid);
    document && document.deleteCursor(user);
  };

}

export default DocumentManager;
