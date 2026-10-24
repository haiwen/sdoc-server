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
  default: {getInstance: () => ({sendDocumentUpdateToRoom: jest.fn()})},
}));

import Document from '../../src/modules/sdoc/models/document';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';
import { listPendingOperationsByDoc, recordOperations } from '../../src/modules/sdoc/dao/operation-log';
import { getReviewApplyRegistration, createReviewApplyRegistration } from '../../src/modules/sdoc/dao/review-apply';
import { buildDocumentContext } from '../../src/modules/sdoc/utils/agent-context';
import { applyPayloadDigest, selectionDigest } from '../../src/modules/sdoc/utils/sdoc-canonical';

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
      target: {block_id: block.block_id, text_node_id: block.text_node_id,
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
