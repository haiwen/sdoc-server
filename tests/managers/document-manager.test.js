jest.mock('../../src/modules/sdoc/dao/review-apply', () => ({
  getReviewApplyRegistration: jest.fn(),
  createReviewApplyRegistration: jest.fn(),
  listPendingReviewSaveRegistrations: jest.fn(),
  markReviewApplyPersistence: jest.fn(),
  listPendingReviewSaveDocUuids: jest.fn(),
}));

import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';
import {
  getReviewApplyRegistration, listPendingReviewSaveRegistrations,
  markReviewApplyPersistence,
} from '../../src/modules/sdoc/dao/review-apply';
import { applyPayloadDigest, selectionDigest } from '../../src/modules/sdoc/utils/sdoc-canonical';

describe('SDoc review apply idempotency', () => {
  it('returns the recorded result before checking a reloaded document incarnation', async () => {
    const manager = DocumentManager.getInstance();
    const applyAttemptId = '00000000-0000-4000-8000-000000000001';
    const result = {status: 'applied', apply_attempt_id: applyAttemptId};
    const originalQueue = manager.enqueueDocWrite;
    const originalDocuments = manager.documents;
    const originalRegistrations = manager.applyRegistrations;
    const taskId = '00000000-0000-4000-8000-000000000002';
    const reviewDecisionId = '00000000-0000-4000-8000-000000000003';
    const changesetRevisionId = '00000000-0000-4000-8000-000000000004';
    const itemId = '00000000-0000-4000-8000-000000000005';
    const selectedItems = [{
      item_id: itemId,
      kind: 'set_block_type',
      target: {
        block_id: 'block-1', block_type: 'paragraph',
        ancestor_path: [{type: 'document', id: null}],
      },
      precondition: {
        canonical_before_hash: 'a'.repeat(64),
        hash_algorithm: 'SHA-256',
        hash_schema_version: 'sdoc-canonical/v1',
        projection_version: 'sdoc-agent-context/v1',
      },
      after_type: 'header2',
    }];
    const selection = selectionDigest({
      taskId, cardRevision: 1, changesetRevision: 1,
      decisionKind: 'approved', selectedChangeItemIds: [itemId],
    });
    const payload = applyPayloadDigest({
      taskId, reviewDecisionId, cardRevision: 1, changesetRevisionId,
      changesetRevision: 1, selectionDigestValue: selection, selectedItems,
    });

    manager.enqueueDocWrite = async (_docUuid, callback) => callback();
    // Simulate a restart or cache eviction: no in-memory document or result remains.
    manager.documents = new Map();
    manager.applyRegistrations = new Map();

    try {
      const params = {
        apply_attempt_id: applyAttemptId,
        task_id: taskId,
        review_decision_id: reviewDecisionId,
        snapshot_id: '00000000-0000-4000-8000-000000000007',
        document_incarnation: '00000000-0000-4000-8000-000000000008',
        file_uuid: '00000000-0000-4000-8000-000000000009',
        doc_uuid: '00000000-0000-4000-8000-000000000009',
        card_revision: 1,
        changeset_revision_id: changesetRevisionId,
        changeset_revision: 1,
        decision_kind: 'approved',
        selected_change_item_ids: [itemId],
        selection_digest: selection,
        apply_payload_digest: payload,
        selected_items: selectedItems,
      };
      getReviewApplyRegistration.mockResolvedValue({
        apply_attempt_id: applyAttemptId,
        doc_uuid: 'doc-uuid',
        apply_payload_digest: payload,
        status: 'applied',
        result,
      });

      await expect(manager.applyReviewChangeSet('doc-uuid', 'Document', params, 'reviewer@example.com')).resolves.toEqual(result);
      expect(getReviewApplyRegistration).toHaveBeenCalledWith(applyAttemptId);
    } finally {
      manager.enqueueDocWrite = originalQueue;
      manager.documents = originalDocuments;
      manager.applyRegistrations = originalRegistrations;
    }
  });

  it('shares one cold-document load between Apply and ordinary callers', async () => {
    const manager = DocumentManager.getInstance();
    const originalDocuments = manager.documents;
    const originalLoads = manager.docLoadPromises;
    const originalLoadDoc = manager.loadDoc;
    let resolveLoad;
    const loadPromise = new Promise(resolve => {
      resolveLoad = resolve;
    });
    manager.documents = new Map();
    manager.docLoadPromises = new Map();
    manager.loadDoc = jest.fn(() => loadPromise);

    try {
      const first = manager.getDoc('doc-uuid', 'Document');
      const second = manager.getDoc('doc-uuid', 'Document');
      expect(manager.loadDoc).toHaveBeenCalledTimes(1);
      resolveLoad({version: 1});
      await expect(Promise.all([first, second])).resolves.toEqual([{version: 1}, {version: 1}]);
    } finally {
      manager.documents = originalDocuments;
      manager.docLoadPromises = originalLoads;
      manager.loadDoc = originalLoadDoc;
    }
  });

  it('redelivers a persisted save result from the durable registration after restart', async () => {
    const manager = DocumentManager.getInstance();
    const originalTasks = manager.reviewSaveTasks;
    const originalSend = seaServerAPI.sendReviewSaveResult;
    manager.reviewSaveTasks = new Map();
    listPendingReviewSaveRegistrations.mockResolvedValue([{
      apply_attempt_id: 'apply-attempt-id',
      applied_sdoc_version: 7,
      result: {
        operation_log_correlation_id: 'operation-log-id',
        document_incarnation: 'document-incarnation',
        approved_by: 'reviewer@example.com',
      },
    }]);
    seaServerAPI.sendReviewSaveResult = jest.fn().mockResolvedValue({});

    try {
      await manager.sendReviewSaveResults('doc-uuid', 7, 'persisted');
      expect(seaServerAPI.sendReviewSaveResult).toHaveBeenCalledWith(expect.objectContaining({
        applyAttemptId: 'apply-attempt-id',
        appliedVersion: 7,
        outcome: 'persisted',
      }));
      expect(markReviewApplyPersistence).toHaveBeenCalledWith('apply-attempt-id', 'persisted');
    } finally {
      manager.reviewSaveTasks = originalTasks;
      seaServerAPI.sendReviewSaveResult = originalSend;
      listPendingReviewSaveRegistrations.mockReset();
      markReviewApplyPersistence.mockReset();
    }
  });

  it('queues reload behind an active Apply for the same document', async () => {
    const manager = DocumentManager.getInstance();
    const originalQueues = manager.docWriteQueues;
    const originalReload = manager.reloadDocUnsafe;
    let finishApply;
    const applyPromise = new Promise(resolve => {
      finishApply = resolve;
    });
    manager.docWriteQueues = new Map();
    manager.reloadDocUnsafe = jest.fn().mockResolvedValue({version: 2});

    try {
      const apply = manager.enqueueDocWrite('doc-uuid', () => applyPromise);
      const reload = manager.reloadDoc('doc-uuid', 'Document');
      await Promise.resolve();
      expect(manager.reloadDocUnsafe).not.toHaveBeenCalled();

      finishApply({version: 1});
      await expect(apply).resolves.toEqual({version: 1});
      await expect(reload).resolves.toEqual({version: 2});
      expect(manager.reloadDocUnsafe).toHaveBeenCalledWith('doc-uuid', 'Document');
    } finally {
      manager.docWriteQueues = originalQueues;
      manager.reloadDocUnsafe = originalReload;
    }
  });

  it('makes concurrent document reads join an in-progress reload', async () => {
    const manager = DocumentManager.getInstance();
    const originalDocs = manager.documents;
    const originalLoads = manager.docLoadPromises;
    const originalRemove = manager.removeDocFromMemoryUnsafe;
    const originalLoad = manager.loadDoc;
    let finishLoad;
    const loadPromise = new Promise(resolve => {
      finishLoad = resolve;
    });
    manager.documents = new Map();
    manager.docLoadPromises = new Map();
    manager.removeDocFromMemoryUnsafe = jest.fn().mockResolvedValue(undefined);
    manager.loadDoc = jest.fn().mockReturnValue(loadPromise);

    try {
      const reload = manager.reloadDocUnsafe('doc-uuid', 'Document');
      await Promise.resolve();
      const concurrentRead = manager.getDoc('doc-uuid', 'Document', 'Document');
      expect(manager.loadDoc).toHaveBeenCalledTimes(1);

      finishLoad({version: 2});
      await expect(reload).resolves.toEqual({version: 2});
      await expect(concurrentRead).resolves.toEqual({version: 2});
    } finally {
      manager.documents = originalDocs;
      manager.docLoadPromises = originalLoads;
      manager.removeDocFromMemoryUnsafe = originalRemove;
      manager.loadDoc = originalLoad;
    }
  });

  it('builds a stable snapshot id for the same live document version', async () => {
    const manager = DocumentManager.getInstance();
    const originalQueue = manager.enqueueDocWrite;
    const originalGetDoc = manager.getDoc;
    const originalDocuments = manager.documents;
    const document = {
      elements: [], version: 7,
      document_incarnation: '00000000-0000-4000-8000-000000000008',
    };
    manager.enqueueDocWrite = async (_docUuid, callback) => callback();
    manager.getDoc = jest.fn().mockResolvedValue({version: 7});
    manager.documents = new Map([['doc-uuid', document]]);

    try {
      const first = await manager.buildReviewSnapshot(
        'doc-uuid', 'Document', '00000000-0000-4000-8000-000000000009',
        'Document', 'reviewer@example.com');
      const second = await manager.buildReviewSnapshot(
        'doc-uuid', 'Document', '00000000-0000-4000-8000-000000000009',
        'Document', 'reviewer@example.com');
      expect(second.snapshot_id).toEqual(first.snapshot_id);
      document.version = 8;
      const changed = await manager.buildReviewSnapshot(
        'doc-uuid', 'Document', '00000000-0000-4000-8000-000000000009',
        'Document', 'reviewer@example.com');
      expect(changed.snapshot_id).not.toEqual(first.snapshot_id);
    } finally {
      manager.enqueueDocWrite = originalQueue;
      manager.getDoc = originalGetDoc;
      manager.documents = originalDocuments;
    }
  });

  it('queues document removal behind an active Apply', async () => {
    const manager = DocumentManager.getInstance();
    const originalQueues = manager.docWriteQueues;
    const originalRemove = manager.removeDocFromMemoryUnsafe;
    let finishApply;
    const applyPromise = new Promise(resolve => {
      finishApply = resolve;
    });
    manager.docWriteQueues = new Map();
    manager.removeDocFromMemoryUnsafe = jest.fn().mockResolvedValue(true);

    try {
      const apply = manager.enqueueDocWrite('doc-uuid', () => applyPromise);
      const remove = manager.removeDoc('doc-uuid');
      await Promise.resolve();
      expect(manager.removeDocFromMemoryUnsafe).not.toHaveBeenCalled();

      finishApply({status: 'applied'});
      await apply;
      await expect(remove).resolves.toBe(true);
      expect(manager.removeDocFromMemoryUnsafe).toHaveBeenCalledWith('doc-uuid');
    } finally {
      manager.docWriteQueues = originalQueues;
      manager.removeDocFromMemoryUnsafe = originalRemove;
    }
  });
});
