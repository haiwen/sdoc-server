import { canonicalBeforeHash, CanonicalizationError, CANONICAL_HASH_SCHEMA, PROJECTION_VERSION, SHA256 } from './sdoc-canonical';
import { Text } from '@seafile/slate';
import logger from '../../../loggers';

const TEXT_BLOCK_TYPES = new Set([
  'title', 'subtitle', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6', 'paragraph',
]);
// Section headings (chapter/section structure). title/subtitle are document
// metadata and do NOT become part of a block's ancestor_path.
const SECTION_HEADER_TYPES = new Set(['header1', 'header2', 'header3', 'header4', 'header5', 'header6']);
const HEADER_LEVEL = {header1: 1, header2: 2, header3: 3, header4: 4, header5: 5, header6: 6};
const LIST_TYPES = new Set(['ordered_list', 'unordered_list']);

const SUPPORTED_KIND = 'replace_block_text';
const TABLE_CELL_KIND = 'replace_table_cell_text';
const DOCUMENT_CONTEXT_SCHEMA = 'sdoc-document-context/v1';

// Properties a Slate text leaf may carry besides `text`. `id` is the seadoc node
// id; any other own property is a formatting mark.
const NON_MARK_KEYS = new Set(['text', 'id']);

const isSinglePlainTextLeaf = (children) => {
  if (!Array.isArray(children) || children.length !== 1) return {supported: false, reason: 'not_single_leaf'};
  const leaf = children[0];
  if (!Text.isText(leaf)) return {supported: false, reason: 'not_plain_text'};
  const markKeys = Object.keys(leaf).filter(key => !NON_MARK_KEYS.has(key));
  if (markKeys.length > 0) return {supported: false, reason: 'has_marks'};
  return {supported: true, leaf};
};

/**
 * Build the immutable Agent Document Context projection from in-memory Slate
 * elements. This is the sole generator of ``ancestor_path`` and
 * ``canonical_before_hash`` values for the review protocol.
 *
 * @param {object} args
 * @param {Array} args.elements  Slate top-level elements.
 * @param {number} args.version   exact SDoc version.
 * @param {string} args.fileUuid  FileUUIDMap canonical UUID.
 * @param {string} args.documentIncarnation SDoc Server per-load incarnation UUID.
 * @param {string} args.snapshotId Snapshot UUID.
 * @param {string} [args.projectionVersion]
 */
export function buildDocumentContext({elements, version, fileUuid, documentIncarnation, snapshotId, projectionVersion = PROJECTION_VERSION}) {
  const outline = [];
  const blocks = [];
  const lists = [];
  const headerStack = [];

  const headerAncestorPath = () => [
    {type: 'document', id: null},
    ...headerStack.map(h => ({type: h.type, id: h.id})),
  ];
  const currentSectionId = () => (headerStack.length ? headerStack[headerStack.length - 1].id : null);

  const pushHeader = (node) => {
    const level = HEADER_LEVEL[node.type] !== undefined ? HEADER_LEVEL[node.type] : -1;
    while (headerStack.length && HEADER_LEVEL[headerStack[headerStack.length - 1].type] >= level) {
      headerStack.pop();
    }
    headerStack.push({type: node.type, id: node.id});
    outline.push({block_id: node.id, type: node.type, text: leafText(node), level});
  };

  const leafText = (node) => {
    const text = (node.children || []).map(child => (typeof child.text === 'string' ? child.text : '')).join('');
    return text;
  };

  const addBlock = ({node, extraAncestors = [], kind = SUPPORTED_KIND}) => {
    const leafCheck = isSinglePlainTextLeaf(node.children);
    if (!leafCheck.supported) {
      blocks.push({
        block_id: node.id,
        text_node_id: null,
        type: node.type,
        section_id: currentSectionId(),
        ancestor_path: headerAncestorPath(),
        plain_text: leafText(node),
        before_leaf_text: null,
        canonical_before_hash: null,
        hash_algorithm: SHA256,
        hash_schema_version: CANONICAL_HASH_SCHEMA,
        supported: false,
        unsupported_reason: leafCheck.reason,
      });
      return;
    }
    const leaf = leafCheck.leaf;
    const ancestorPath = [...headerAncestorPath(), ...extraAncestors];
    let canonicalHash = null;
    try {
      canonicalHash = canonicalBeforeHash({
        blockId: node.id,
        textNodeId: leaf.id,
        blockType: node.type,
        ancestorPath,
        beforeLeafText: leaf.text,
        fileUuid,
        documentIncarnation,
        projectionVersion,
        kind,
      });
    } catch (error) {
      if (!(error instanceof CanonicalizationError)) throw error;
      logger.warn('SDoc Agent Context excludes block %s: %s', node.id, error.message);
      blocks.push({
        block_id: node.id, text_node_id: leaf.id, type: node.type,
        section_id: currentSectionId(), ancestor_path: ancestorPath,
        plain_text: leafText(node), before_leaf_text: leaf.text,
        canonical_before_hash: null, hash_algorithm: SHA256,
        hash_schema_version: CANONICAL_HASH_SCHEMA, supported: false,
        unsupported_reason: 'canonicalization_failed',
      });
      return;
    }
    blocks.push({
      block_id: node.id,
      text_node_id: leaf.id,
      type: node.type,
      section_id: currentSectionId(),
      ancestor_path: ancestorPath,
      plain_text: leaf.text,
      before_leaf_text: leaf.text,
      canonical_before_hash: canonicalHash,
      hash_algorithm: SHA256,
      hash_schema_version: CANONICAL_HASH_SCHEMA,
      supported: true,
    });
  };

  const visitList = (listNode) => {
    (listNode.children || []).forEach(listItem => {
      if (listItem.type !== 'list_item') return;
      (listItem.children || []).forEach(child => {
        if (TEXT_BLOCK_TYPES.has(child.type)) {
          addBlock({node: child, extraAncestors: [{type: listNode.type, id: listNode.id}, {type: 'list_item', id: listItem.id}]});
        }
      });
    });
  };

  // Display-only review metadata: retain each list item's original text so a
  // list-type suggestion can show a useful bullet-to-number preview.
  const listPreviewItems = (listNode) => (listNode.children || [])
    .filter(node => node && node.type === 'list_item')
    .map((listItem) => (listItem.children || [])
      .filter(child => child && TEXT_BLOCK_TYPES.has(child.type))
      .map(leafText)
      .filter(Boolean)
      .join('\n'))
    .filter(Boolean);

  const visitTable = (tableNode) => {
    (tableNode.children || []).forEach(row => {
      if (row.type !== 'table_row') return;
      (row.children || []).forEach(cell => {
        if (cell.type !== 'table_cell') return;
        addBlock({
          node: cell,
          extraAncestors: [{type: 'table', id: tableNode.id}, {type: 'table_row', id: row.id}],
          kind: TABLE_CELL_KIND,
        });
      });
    });
  };

  (elements || []).forEach(node => {
    if (!node || typeof node !== 'object') return;
    if (SECTION_HEADER_TYPES.has(node.type)) {
      pushHeader(node);
    }
    if (TEXT_BLOCK_TYPES.has(node.type)) {
      addBlock({node});
    } else if (LIST_TYPES.has(node.type)) {
      lists.push({
        block_id: node.id,
        type: node.type,
        ancestor_path: headerAncestorPath(),
        items: listPreviewItems(node),
      });
      visitList(node);
    } else if (node.type === 'table') {
      visitTable(node);
    }
    // media / code_block / callout / etc. are not writable.
  });

  return {
    schema_version: DOCUMENT_CONTEXT_SCHEMA,
    snapshot_id: snapshotId,
    file_uuid: fileUuid,
    document_incarnation: documentIncarnation,
    exact_sdoc_version: version,
    projection_version: projectionVersion,
    outline,
    blocks,
    lists,
  };
}
