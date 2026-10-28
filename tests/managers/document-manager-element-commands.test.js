jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
  recordOperations: jest.fn(),
  queryOperationCount: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/api/sea-server-api', () => ({
  getDocContent: jest.fn(),
  saveDocContent: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/dao/review-apply', () => ({
  listPendingReviewSaveRegistrations: jest.fn().mockResolvedValue([]),
  getReviewApplyRegistration: jest.fn(),
  createReviewApplyRegistration: jest.fn(),
}));

jest.mock('../../src/db-helper', () => ({
  withTransaction: jest.fn(callback => callback({transaction: true})),
}));

jest.mock('../../src/modules/sdoc/wio/io-helper', () => ({
  __esModule: true,
  default: {getInstance: () => ({sendDocumentUpdate: jest.fn()})},
}));

import Document from '../../src/modules/sdoc/models/document';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';
import { listPendingOperationsByDoc, recordOperations } from '../../src/modules/sdoc/dao/operation-log';
import { getReviewApplyRegistration, createReviewApplyRegistration } from '../../src/modules/sdoc/dao/review-apply';
import { buildDocumentContext } from '../../src/modules/sdoc/utils/agent-context';
import { applyPayloadDigest, selectionDigest } from '../../src/modules/sdoc/utils/sdoc-canonical';
import { withTransaction } from '../../src/db-helper';
import IOHelper from '../../src/modules/sdoc/wio/io-helper';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const makeDocument = () => new Document('doc-1', 'test.sdoc', {
  version: 4,
  format_version: 4,
  last_modify_user: '',
  elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
});

const replaceCommand = text => ({
  kind: 'replace_element_content',
  target_element_id: 'p1',
  payload: { text },
});

const applyCommands = (documentManager, commands) => {
  return documentManager.applyElementCommands('doc-1', 'test.sdoc', undefined, 'writer@example.com', { commands });
};

const makeReviewParams = document => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const block = buildDocumentContext({elements: document.elements, version: document.version,
    fileUuid: id(1), documentIncarnation: document.document_incarnation, snapshotId: id(2)}).blocks[0];
  const item = {item_id: id(5), kind: 'replace_block_text',
    target: {block_id: block.block_id, block_type: block.type, ancestor_path: block.ancestor_path},
    precondition: {canonical_before_hash: block.canonical_before_hash, before_leaf_text: block.before_leaf_text,
      hash_algorithm: 'SHA-256', hash_schema_version: 'sdoc-canonical/v1', projection_version: 'sdoc-agent-context/v1'},
    after_text: 'reviewed'};
  const selection = selectionDigest({taskId: id(2), cardRevision: 1, changesetRevision: 1,
    decisionKind: 'approved', selectedChangeItemIds: [id(5)]});
  return {apply_attempt_id: id(6), task_id: id(2), review_decision_id: id(3), file_uuid: id(1), doc_uuid: id(1),
    snapshot_id: id(2), document_incarnation: document.document_incarnation, card_revision: 1,
    changeset_revision_id: id(4), changeset_revision: 1, decision_kind: 'approved',
    selected_change_item_ids: [id(5)], selected_items: [item], selection_digest: selection,
    apply_payload_digest: applyPayloadDigest({taskId: id(2), reviewDecisionId: id(3), cardRevision: 1,
      changesetRevisionId: id(4), changesetRevision: 1, selectionDigestValue: selection, selectedItems: [item]})};
};

describe('review commit recovery regressions', () => {
  let manager;
  let document;
  let params;
  let registration;
  let save;
  let broadcast;
  const apply = () => manager.applyReviewChangeSet(params.doc_uuid, 'test.sdoc', params, 'reviewer');

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new DocumentManager();
    document = makeDocument();
    params = makeReviewParams(document);
    manager.documents.set(params.doc_uuid, document);
    OperationsManager.getInstance().operationListMap.clear();
    registration = null;
    getReviewApplyRegistration.mockImplementation(async () => registration);
    createReviewApplyRegistration.mockImplementation(async value => {
      registration = {doc_uuid: value.docUuid, apply_payload_digest: value.applyPayloadDigest,
        status: value.status, result: value.result};
    });
    recordOperations.mockResolvedValue();
    listPendingOperationsByDoc.mockResolvedValue([]);
    withTransaction.mockImplementation(callback => callback({transaction: true}));
    save = jest.spyOn(manager, 'saveDoc').mockResolvedValue(true);
    broadcast = jest.fn();
    jest.spyOn(IOHelper, 'getInstance').mockReturnValue({sendDocumentUpdate: broadcast});
  });

  afterEach(() => jest.restoreAllMocks());

  it('installs an acknowledged-late commit exactly once before the next queued writer', async () => {
    withTransaction.mockImplementationOnce(async callback => {
      await callback({transaction: true});
      throw new Error('COMMIT acknowledgement lost');
    });
    const resultPromise = apply();
    const next = manager.enqueueDocWrite(params.doc_uuid, () => {
      expect(document.version).toBe(5);
      expect(document.elements[0].children[0].text).toBe('reviewed');
      expect(broadcast).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);
    });
    await expect(resultPromise).resolves.toMatchObject({status: 'applied'});
    await next;
    await expect(apply()).resolves.toMatchObject({status: 'applied'});
    expect(recordOperations).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(OperationsManager.getInstance().operationListMap.get(params.doc_uuid)).toHaveLength(1);
  });

  it.each([true, false])('recovers unknown transaction outcome (committed=%s) and fences all writers until lookup recovers', async committed => {
    withTransaction.mockImplementationOnce(async callback => {
      if (committed) await callback({transaction: true});
      throw new Error('transaction disconnected');
    });
    getReviewApplyRegistration.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('lookup offline'));
    await expect(apply()).rejects.toThrow('lookup offline');
    getReviewApplyRegistration.mockRejectedValue(new Error('still offline'));
    const writer = jest.fn();
    await expect(manager.enqueueDocWrite(params.doc_uuid, writer)).rejects.toThrow('still offline');
    await expect(manager.getDoc(params.doc_uuid, 'test.sdoc')).rejects.toThrow('still offline');
    await expect(manager.applyElementCommands(params.doc_uuid, 'test.sdoc', null, 'writer',
      {commands: [replaceCommand('unsafe')]})).rejects.toThrow('still offline');
    await expect(manager.execOperationsBySocket({doc_uuid: params.doc_uuid, version: 4,
      operations: [], user: {username: 'writer'}}, 'test.sdoc')).rejects.toThrow('still offline');
    await expect(manager.reloadDoc(params.doc_uuid, 'test.sdoc')).rejects.toThrow('still offline');
    await expect(manager.removeDoc(params.doc_uuid)).rejects.toThrow('still offline');
    await expect(manager.enqueueDocWrite(params.doc_uuid,
      () => manager.saveDocUnsafe(params.doc_uuid))).rejects.toThrow('still offline');
    expect(writer).not.toHaveBeenCalled();
    expect(document.version).toBe(4);
    getReviewApplyRegistration.mockImplementation(async () => registration);
    const result = await manager.getApplyResult(params.doc_uuid, params.apply_attempt_id);
    expect(result).toMatchObject(committed ? {status: 'applied'} :
      {status: 'failed_precommit', error_code: 'operation_log_failed'});
    expect(document.version).toBe(committed ? 5 : 4);
    expect(getReviewApplyRegistration).toHaveBeenCalledWith(params.apply_attempt_id, {transaction: true}, true);
    expect(manager.applyRegistrations.get(params.apply_attempt_id).status).not.toBe('committing');
    await expect(manager.enqueueDocWrite(params.doc_uuid, writer)).resolves.toBeUndefined();
    expect(writer).toHaveBeenCalledTimes(1);
    await expect(apply()).resolves.toEqual(result);
    expect(recordOperations).toHaveBeenCalledTimes(committed ? 1 : 0);
  });

  it('does not fence the original transaction while it is still executing', async () => {
    const transaction = deferred();
    withTransaction.mockImplementationOnce(async callback => {
      await transaction.promise;
      return callback({transaction: true});
    });
    const result = apply();
    await Promise.resolve();
    await Promise.resolve();
    const writer = jest.fn();
    const next = manager.enqueueDocWrite(params.doc_uuid, writer);
    expect(writer).not.toHaveBeenCalled();
    transaction.resolve();
    await result;
    await next;
    expect(document.version).toBe(5);
    expect(recordOperations).toHaveBeenCalledTimes(1);
  });

  it('isolates reconciliation failure during autosave and releases the global save lock', async () => {
    withTransaction.mockImplementationOnce(async callback => {
      await callback({transaction: true});
      throw new Error('commit disconnected');
    });
    getReviewApplyRegistration.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('lookup offline'));
    await expect(apply()).rejects.toThrow('lookup offline');
    manager.documents.set('unrelated', makeDocument());
    manager.saveDoc.mockRestore();
    const save = jest.spyOn(manager, 'saveDocUnsafe').mockResolvedValue(true);
    jest.spyOn(manager, 'removeDocsWithNoAccess').mockResolvedValue();
    getReviewApplyRegistration.mockRejectedValue(new Error('still offline'));
    await expect(manager.saveAllDocs()).resolves.toBeUndefined();
    expect(manager.isSaving).toBe(false);
    expect(save).toHaveBeenCalledWith('unrelated');
    expect(save).not.toHaveBeenCalledWith(params.doc_uuid);
    expect(manager.removeDocsWithNoAccess).toHaveBeenCalledWith([]);
    getReviewApplyRegistration.mockImplementation(async () => registration);
    await manager.getApplyResult(params.doc_uuid, params.apply_attempt_id);
    save.mockClear();
    await manager.saveAllDocs();
    expect(save).toHaveBeenCalledWith(params.doc_uuid);
    expect(save).toHaveBeenCalledWith('unrelated');
    expect(manager.isSaving).toBe(false);
  });

  it('releases the global save lock even if cleanup fails', async () => {
    jest.spyOn(manager, 'removeDocsWithNoAccess').mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(manager.saveAllDocs()).rejects.toThrow('cleanup failed');
    expect(manager.isSaving).toBe(false);
    await expect(manager.saveAllDocs()).resolves.toBeUndefined();
  });

  it('continues inactive-document cleanup after a fenced document fails reconciliation', async () => {
    const visited = [];
    jest.spyOn(manager, 'enqueueDocWrite').mockImplementation(async docUuid => {
      visited.push(docUuid);
      if (docUuid === 'fenced') throw new Error('lookup offline');
    });
    await expect(manager.removeDocsWithNoAccess(['fenced', 'unrelated'])).resolves.toBeUndefined();
    expect(visited).toEqual(['fenced', 'unrelated']);
  });

  it('lets an Apply retry finish its unknown commit before checking the old preconditions', async () => {
    withTransaction.mockImplementationOnce(async callback => {
      await callback({transaction: true});
      throw new Error('commit disconnected');
    });
    getReviewApplyRegistration.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('lookup offline'));
    await expect(apply()).rejects.toThrow('lookup offline');
    await expect(apply()).resolves.toMatchObject({status: 'applied', applied_sdoc_version: 5});
    expect(document.elements[0].children[0].text).toBe('reviewed');
    expect(recordOperations).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('retains the fence if recording a confirmed rollback result also fails', async () => {
    withTransaction.mockRejectedValueOnce(new Error('transaction failed'));
    createReviewApplyRegistration.mockRejectedValueOnce(new Error('receipt write offline'));
    await expect(apply()).rejects.toThrow('receipt write offline');
    expect(document.version).toBe(4);
    const result = await manager.getApplyResult(params.doc_uuid, params.apply_attempt_id);
    expect(result).toMatchObject({status: 'failed_precommit', error_code: 'operation_log_failed'});
    expect(recordOperations).not.toHaveBeenCalled();
  });

  it('cold-loads committed operations after restart without reapplying a historical plan', async () => {
    await apply();
    const operations = recordOperations.mock.calls[0][1];
    const fresh = new DocumentManager();
    seaServerAPI.getDocContent.mockResolvedValue({data: makeDocument().toJson()});
    listPendingOperationsByDoc.mockResolvedValue([{operations: JSON.stringify(operations), op_id: 5, author: 'reviewer'}]);
    await expect(fresh.getApplyResult(params.doc_uuid, params.apply_attempt_id)).resolves.toMatchObject({status: 'applied'});
    await fresh.getDoc(params.doc_uuid, 'test.sdoc');
    expect(fresh.documents.get(params.doc_uuid).version).toBe(5);
    expect(fresh.documents.get(params.doc_uuid).elements[0].children[0].text).toBe('reviewed');
    expect(recordOperations).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it.each(['replace_block_text', 'set_block_type', 'set_list_type', 'insert_block', 'delete_block']
    .flatMap(kind => [[kind, false], [kind, true]]))(
    'compares ancestor content for %s (changed=%s)', async (kind, changed) => {
      if (kind === 'set_list_type') {
        document.elements = [{id: 'list', type: 'unordered_list', children: [
          {id: 'item', type: 'list_item', children: [
            {id: 'list-p', type: 'paragraph', children: [{id: 'leaf', text: 'before'}]},
          ]},
        ]}];
      }
      const projection = buildDocumentContext({elements: document.elements, version: document.version,
        fileUuid: params.doc_uuid, documentIncarnation: document.document_incarnation, snapshotId: params.snapshot_id});
      const block = kind === 'set_list_type' ? projection.lists[0] : projection.blocks[0];
      const item = {item_id: params.selected_change_item_ids[0], kind,
        target: {block_id: block.block_id, block_type: block.type,
          ancestor_path: block.ancestor_path.map(({id, type}) => ({id, type}))},
        precondition: {hash_algorithm: 'SHA-256', hash_schema_version: 'sdoc-canonical/v1',
          projection_version: 'sdoc-agent-context/v1', canonical_before_hash: block.canonical_before_hash}};
      if (changed) item.target.ancestor_path.push({id: 'another-section', type: 'header1'});
      if (kind === 'replace_block_text') {
        item.precondition.before_leaf_text = block.before_leaf_text;
        item.after_text = 'reviewed';
      } else if (kind === 'set_block_type') {
        item.precondition.canonical_before_hash = block.type_before_hash;
        item.after_type = 'header2';
      } else if (kind === 'set_list_type') {
        item.after_type = 'ordered_list';
      } else {
        item.precondition.canonical_before_hash = block.structure_before_hash;
        if (kind === 'insert_block') Object.assign(item, {after_type: 'paragraph', after_text: 'inserted', placement: 'after'});
      }
      params.selected_items = [item];
      params.apply_payload_digest = applyPayloadDigest({taskId: params.task_id, reviewDecisionId: params.review_decision_id,
        cardRevision: params.card_revision, changesetRevisionId: params.changeset_revision_id,
        changesetRevision: params.changeset_revision, selectionDigestValue: params.selection_digest, selectedItems: [item]});
      if (changed) {
        await expect(apply()).resolves.toMatchObject({status: 'preflight_conflicted',
          conflicts: [{item_id: item.item_id, conflict_code: 'ancestor_path_mismatch'}]});
        expect(recordOperations).not.toHaveBeenCalled();
      } else {
        await expect(apply()).resolves.toMatchObject({status: 'applied', applied_sdoc_version: 5});
        expect(recordOperations).toHaveBeenCalledTimes(1);
      }
    });

  it.each(['document_not_found', 'database_error'])('persists only an explicit missing-document error (%s)', async code => {
    manager.documents.clear();
    jest.spyOn(manager, 'getDoc').mockRejectedValue(Object.assign(new Error(code), {error_code: code}));
    if (code === 'document_not_found') {
      await expect(apply()).resolves.toMatchObject({status: 'failed_precommit', error_code: 'document_unavailable'});
      await expect(manager.getApplyResult(params.doc_uuid, params.apply_attempt_id)).resolves.toMatchObject({error_code: 'document_unavailable'});
      expect(createReviewApplyRegistration).toHaveBeenCalledTimes(1);
    } else {
      await expect(apply()).rejects.toThrow(code);
      expect(createReviewApplyRegistration).not.toHaveBeenCalled();
    }
    expect(recordOperations).not.toHaveBeenCalled();
  });
});

describe('DocumentManager element command commits', () => {
  let documentManager;

  beforeEach(() => {
    documentManager = DocumentManager.getInstance();
    documentManager.documents.clear();
    documentManager.documentLoadPromises.clear();
    OperationsManager.getInstance().operationListMap.clear();
    listPendingOperationsByDoc.mockReset();
    listPendingOperationsByDoc.mockResolvedValue([]);
    recordOperations.mockReset();
    seaServerAPI.getDocContent.mockReset();
    seaServerAPI.saveDocContent.mockReset();
    documentManager.documents.set('doc-1', makeDocument());
  });

  it('executes a signed review through element commands atomically and replays its durable receipt', async () => {
    const document = documentManager.documents.get('doc-1');
    const fileUuid = '00000000-0000-4000-8000-000000000001';
    const taskId = '00000000-0000-4000-8000-000000000002';
    const decisionId = '00000000-0000-4000-8000-000000000003';
    const changesetId = '00000000-0000-4000-8000-000000000004';
    const itemId = '00000000-0000-4000-8000-000000000005';
    const attemptId = '00000000-0000-4000-8000-000000000006';
    documentManager.documents.set(fileUuid, document);
    const projection = buildDocumentContext({
      elements: document.elements, version: document.version, fileUuid,
      documentIncarnation: document.document_incarnation, snapshotId: taskId,
    });
    const block = projection.blocks[0];
    const item = {
      item_id: itemId, kind: 'replace_block_text',
      target: {block_id: block.block_id,
        block_type: block.type, ancestor_path: block.ancestor_path},
      precondition: {canonical_before_hash: block.canonical_before_hash,
        before_leaf_text: block.before_leaf_text, hash_algorithm: 'SHA-256',
        hash_schema_version: 'sdoc-canonical/v1', projection_version: 'sdoc-agent-context/v1'},
      after_text: 'reviewed',
    };
    const selection = selectionDigest({taskId, cardRevision: 1, changesetRevision: 1,
      decisionKind: 'approved', selectedChangeItemIds: [itemId]});
    const digest = applyPayloadDigest({taskId, reviewDecisionId: decisionId,
      cardRevision: 1, changesetRevisionId: changesetId, changesetRevision: 1,
      selectionDigestValue: selection, selectedItems: [item]});
    const params = {
      apply_attempt_id: attemptId, task_id: taskId, review_decision_id: decisionId,
      file_uuid: fileUuid, doc_uuid: fileUuid, snapshot_id: taskId,
      document_incarnation: document.document_incarnation, card_revision: 1,
      changeset_revision_id: changesetId, changeset_revision: 1, decision_kind: 'approved',
      selected_change_item_ids: [itemId], selected_items: [item],
      selection_digest: selection, apply_payload_digest: digest,
    };
    getReviewApplyRegistration.mockResolvedValue(null);
    createReviewApplyRegistration.mockResolvedValue(undefined);
    recordOperations.mockResolvedValue(undefined);
    const save = jest.spyOn(documentManager, 'saveDoc').mockResolvedValue(true);
    try {
      const mismatched = await documentManager.applyReviewChangeSet(
        fileUuid, 'test.sdoc', {...params, apply_attempt_id: taskId},
        'writer@example.com', [replaceCommand('unsigned content')]);
      expect(mismatched).toMatchObject({status: 'failed_precommit', error_code: 'invalid_selection_payload'});
      expect(document.version).toBe(4);
      expect(recordOperations).not.toHaveBeenCalled();
      document.elements[0].children[0].text = 'concurrent edit';
      const conflicted = await documentManager.applyReviewChangeSet(
        fileUuid, 'test.sdoc', {...params, apply_attempt_id: decisionId},
        'writer@example.com', [replaceCommand('reviewed')]);
      expect(conflicted).toMatchObject({status: 'preflight_conflicted',
        conflicts: [{item_id: itemId, conflict_code: 'before_hash_mismatch'}]});
      expect(recordOperations).not.toHaveBeenCalled();
      document.elements[0].children[0].text = 'before';
      const result = await documentManager.applyReviewChangeSet(
        fileUuid, 'test.sdoc', params, 'writer@example.com', [replaceCommand('reviewed')]);
      expect(result).toMatchObject({status: 'applied', applied_sdoc_version: 5});
      expect(document.elements[0].children[0]).toMatchObject({text: 'reviewed'});
      expect(document.elements[0].children[0].id).not.toBe('t1');
      expect(recordOperations).toHaveBeenCalledWith(fileUuid, expect.arrayContaining([
        expect.objectContaining({type: 'remove_node'}),
        expect.objectContaining({type: 'insert_node'}),
      ]), 5, {username: 'writer@example.com'}, {transaction: true});
      expect(createReviewApplyRegistration).toHaveBeenCalledWith(
        expect.objectContaining({applyAttemptId: attemptId, status: 'applied'}), {transaction: true});
      getReviewApplyRegistration.mockResolvedValue({doc_uuid: fileUuid,
        apply_payload_digest: digest, status: 'applied', result});
      documentManager.documents.delete(fileUuid);
      await expect(documentManager.applyReviewChangeSet(fileUuid, 'test.sdoc', params,
        'writer@example.com', [replaceCommand('reviewed')])).resolves.toEqual(result);
      expect(recordOperations).toHaveBeenCalledTimes(1);
    } finally {
      save.mockRestore();
    }
  });

  it('updates the in-memory document before recording operations', async () => {
    recordOperations.mockImplementation(() => {
      const document = documentManager.documents.get('doc-1');
      expect(document.version).toBe(5);
      expect(document.elements[0].children[0].text).toBe('after');
      expect(document.getMeta().need_save).toBe(true);
      return Promise.resolve();
    });

    const result = await applyCommands(documentManager, [replaceCommand('after')]);

    expect(result.version).toBe(5);
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
  });

  it('returns before operation log persistence completes', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const result = await applyCommands(documentManager, [replaceCommand('after')]);

    expect(documentManager.documents.get('doc-1').version).toBe(5);
    expect(result).toMatchObject({ version: 5 });
    expect(recordOperations).toHaveBeenCalledTimes(1);

    write.resolve();
  });

  it('keeps the in-memory update and reports success when operation log persistence fails', async () => {
    recordOperations.mockRejectedValue(new Error('database unavailable'));

    await expect(applyCommands(documentManager, [replaceCommand('after')])).resolves.toMatchObject({ version: 5 });

    const document = documentManager.documents.get('doc-1');
    expect(document.version).toBe(5);
    expect(document.elements[0].children[0].text).toBe('after');
    expect(document.last_modify_user).toBe('writer@example.com');
    expect(document.getMeta().need_save).toBe(true);
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(true);
  });

  it('returns Socket success immediately and preserves in-memory version order while persistence is pending', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const resultPromise = documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    await expect(resultPromise).resolves.toEqual({ success: true, version: 5 });
    expect(recordOperations).toHaveBeenCalledTimes(1);
    await expect(applyCommands(documentManager, [replaceCommand('after')])).resolves.toMatchObject({ version: 6 });
    expect(OperationsManager.getInstance().operationListMap.get('doc-1').map(item => item.version)).toEqual([5, 6]);

    write.resolve();
  });

  it('keeps Socket success and the in-memory operation when background persistence fails', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: true, version: 5 });
    expect(documentManager.documents.get('doc-1').elements[0].children[0].text).toBe('before!');
    expect(OperationsManager.getInstance().operationListMap.get('doc-1').map(item => item.version)).toEqual([5]);

    write.reject(new Error('database unavailable'));
    await Promise.resolve();
  });

  it('uses the loaded document instance for a cold Socket update', async () => {
    documentManager.documents.clear();
    recordOperations.mockResolvedValue();
    seaServerAPI.getDocContent.mockResolvedValue({
      data: {
        version: 4,
        format_version: 4,
        last_modify_user: '',
        elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
      },
    });

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: true, version: 5 });
    expect(documentManager.documents.get('doc-1').elements[0].children[0].text).toBe('before!');
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
  });

  it('uses the current document state without requiring a caller version', async () => {
    recordOperations.mockResolvedValue();
    const document = documentManager.documents.get('doc-1');
    document.setValue([{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'updated by another writer' }] }], 5);

    await expect(applyCommands(documentManager, [replaceCommand('applied to current content')])).resolves.toMatchObject({ version: 6 });

    expect(document.version).toBe(6);
    expect(document.elements[0].children[0].text).toBe('applied to current content');
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 6, { username: 'writer@example.com' });
  });

  it('shares a cold load and applies concurrent commands to the current document instance', async () => {
    documentManager.documents.clear();
    recordOperations.mockResolvedValue();
    const load = deferred();
    seaServerAPI.getDocContent.mockReturnValue(load.promise);

    const first = applyCommands(documentManager, [replaceCommand('first')]);
    const second = applyCommands(documentManager, [replaceCommand('second')]);

    await Promise.resolve();
    await Promise.resolve();
    expect(seaServerAPI.getDocContent).toHaveBeenCalledTimes(1);
    load.resolve({
      data: {
        version: 4,
        format_version: 4,
        last_modify_user: '',
        elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
      },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ version: 5 }),
      expect.objectContaining({ version: 6 }),
    ]);

    const document = documentManager.documents.get('doc-1');
    expect(document.version).toBe(6);
    expect(document.elements[0].children[0].text).toBe('second');
    expect(recordOperations).toHaveBeenNthCalledWith(1, 'doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
    expect(recordOperations).toHaveBeenNthCalledWith(2, 'doc-1', expect.any(Array), 6, { username: 'writer@example.com' });
  });

  it('maps an upstream 404 during cold load to document_not_found', async () => {
    documentManager.documents.clear();
    seaServerAPI.getDocContent.mockRejectedValue({
      message: 'Request failed with status code 404',
      response: { status: 404 },
    });

    await expect(applyCommands(documentManager, [replaceCommand('after')])).rejects.toMatchObject({
      error_code: 'document_not_found',
    });
    expect(recordOperations).not.toHaveBeenCalled();
  });

  it.each([true, false])('reloads after an in-flight cold load (initial load succeeds=%s)', async succeeds => {
    documentManager.documents.clear();
    const oldLoad = deferred();
    const replacement = deferred();
    seaServerAPI.getDocContent.mockReturnValueOnce(oldLoad.promise).mockReturnValueOnce(replacement.promise);
    const cold = documentManager.getDoc('doc-1', 'test.sdoc');
    const coldResult = cold.catch(() => null);
    const reload = documentManager.reloadDoc('doc-1', 'test.sdoc');
    const reloadResult = reload.catch(error => error);
    // Enter the queued reload while the old request is still outstanding.
    await Promise.resolve();
    await Promise.resolve();
    const reader = documentManager.getDoc('doc-1', 'test.sdoc');
    const readerResult = reader.catch(error => error);
    if (succeeds) oldLoad.resolve({data: makeDocument().toJson()});
    else oldLoad.reject(new Error('old snapshot unavailable'));
    await coldResult;
    // Drain the old load, cache removal and replacement request deterministically.
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(seaServerAPI.getDocContent).toHaveBeenCalledTimes(2);
    const content = makeDocument().toJson();
    content.elements[0].children[0].text = 'replacement';
    listPendingOperationsByDoc.mockResolvedValueOnce([{
      operations: JSON.stringify([{type: 'insert_text', path: [0, 0], offset: 11, text: '!'}]),
      op_id: 5, author: 'reviewer',
    }]);
    replacement.resolve({data: content});
    await expect(reloadResult).resolves.toMatchObject({version: 5});
    await expect(readerResult).resolves.toMatchObject({version: 5});
    expect(documentManager.documents.get('doc-1').elements[0].children[0].text).toBe('replacement!');
    expect(documentManager.documentLoadPromises.has('doc-1')).toBe(false);
  });

  it('does not commit a rejected text-leaf deletion', async () => {
    const document = documentManager.documents.get('doc-1');
    const originalElements = JSON.parse(JSON.stringify(document.elements));

    await expect(applyCommands(documentManager, [{
      kind: 'delete_element', target_element_id: 't1',
    }])).rejects.toMatchObject({ error_code: 'unsupported_element_type', command_index: 0 });

    expect(document.version).toBe(4);
    expect(document.elements).toEqual(originalElements);
    expect(document.getMeta().need_save).toBe(false);
    expect(recordOperations).not.toHaveBeenCalled();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });

  it.each([
    ['a paragraph directly under multi-column', {
      id: 'multi-column', type: 'multi_column', children: [{ id: 'invalid', type: 'paragraph', children: [{ id: 'invalid-text', text: 'invalid' }] }],
    }],
    ['a root-level column', {
      id: 'column', type: 'column', children: [{ id: 'column-paragraph', type: 'paragraph', children: [{ id: 'column-text', text: 'column' }] }],
    }],
  ])('does not commit a document with %s', async (description, invalidElement) => {
    const document = documentManager.documents.get('doc-1');
    document.elements.push(invalidElement);
    const originalElements = JSON.parse(JSON.stringify(document.elements));

    await expect(applyCommands(documentManager, [replaceCommand('after')])).rejects.toMatchObject({
      error_code: 'apply_failed',
    });

    expect(document.version).toBe(4);
    expect(document.elements).toEqual(originalElements);
    expect(document.getMeta().need_save).toBe(false);
    expect(recordOperations).not.toHaveBeenCalled();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });
});
