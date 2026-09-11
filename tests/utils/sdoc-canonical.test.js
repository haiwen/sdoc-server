import { applyPayloadDigest, CanonicalizationError } from '../../src/modules/sdoc/utils/sdoc-canonical';

const BASE = {
  taskId: '00000000-0000-4000-8000-000000000001',
  reviewDecisionId: '00000000-0000-4000-8000-000000000002',
  cardRevision: 1,
  changesetRevisionId: '00000000-0000-4000-8000-000000000003',
  changesetRevision: 1,
  selectionDigestValue: 'a'.repeat(64),
};

const TYPE_ITEM = {
  item_id: '00000000-0000-4000-8000-000000000004',
  kind: 'set_block_type',
  target: {
    block_id: 'block-1',
    block_type: 'paragraph',
    ancestor_path: [{type: 'document', id: null}],
  },
  precondition: {
    canonical_before_hash: 'b'.repeat(64),
    hash_algorithm: 'SHA-256',
    hash_schema_version: 'sdoc-canonical/v1',
    projection_version: 'sdoc-agent-context/v1',
  },
  after_type: 'header2',
};

describe('SDoc Agent apply semantic allowlist', () => {
  it('accepts a supported paragraph-to-heading transition', () => {
    expect(() => applyPayloadDigest({...BASE, selectedItems: [TYPE_ITEM]})).not.toThrow();
  });

  it('rejects a block transition to a list container', () => {
    const item = {...TYPE_ITEM, after_type: 'ordered_list'};
    expect(() => applyPayloadDigest({...BASE, selectedItems: [item]})).toThrow(CanonicalizationError);
  });

  it('rejects a list transition to a non-list type', () => {
    const item = {
      ...TYPE_ITEM,
      kind: 'set_list_type',
      target: {...TYPE_ITEM.target, block_type: 'unordered_list'},
      after_type: 'paragraph',
    };
    expect(() => applyPayloadDigest({...BASE, selectedItems: [item]})).toThrow(CanonicalizationError);
  });

  it('rejects a no-op list transition', () => {
    const item = {
      ...TYPE_ITEM,
      kind: 'set_list_type',
      target: {...TYPE_ITEM.target, block_type: 'unordered_list'},
      after_type: 'unordered_list',
    };
    expect(() => applyPayloadDigest({...BASE, selectedItems: [item]})).toThrow(CanonicalizationError);
  });

  it('rejects table-cell text edits declared as block text edits', () => {
    const item = {
      item_id: TYPE_ITEM.item_id,
      kind: 'replace_block_text',
      target: {
        block_id: 'cell-1',
        text_node_id: 'text-1',
        block_type: 'table_cell',
        ancestor_path: [{type: 'document', id: null}],
      },
      precondition: {
        ...TYPE_ITEM.precondition,
        before_leaf_text: 'before',
      },
      after_text: 'after',
    };
    expect(() => applyPayloadDigest({...BASE, selectedItems: [item]})).toThrow(CanonicalizationError);
  });

  it('rejects table-cell operations that target a paragraph', () => {
    const item = {
      item_id: TYPE_ITEM.item_id,
      kind: 'replace_table_cell_text',
      target: {
        block_id: 'paragraph-1',
        text_node_id: 'text-1',
        block_type: 'paragraph',
        ancestor_path: [{type: 'document', id: null}],
      },
      precondition: {
        ...TYPE_ITEM.precondition,
        before_leaf_text: 'before',
      },
      after_text: 'after',
    };
    expect(() => applyPayloadDigest({...BASE, selectedItems: [item]})).toThrow(CanonicalizationError);
  });
});
