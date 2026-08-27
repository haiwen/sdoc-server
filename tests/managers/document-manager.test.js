jest.mock('../../src/modules/sdoc/dao/review-apply', () => ({
  getReviewApplyRegistration: jest.fn(),
  createReviewApplyRegistration: jest.fn(),
}));

import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import { getReviewApplyRegistration } from '../../src/modules/sdoc/dao/review-apply';
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
});
