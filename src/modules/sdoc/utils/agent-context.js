import { canonicalJsonDumps, canonicalReviewTarget, setBlockTypeHash, setListTypeHash, subtreeIdentityHash, CanonicalizationError, CANONICAL_HASH_SCHEMA, PROJECTION_VERSION, SHA256 } from './sdoc-canonical';
import crypto from 'crypto';
import ElementCommandManager from '../managers/element-command-manager';
import logger from '../../../loggers';

const TEXT_TYPES = new Set(['paragraph', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6']);
const LIST_TYPES = new Set(['ordered_list', 'unordered_list']);
const HEADER_LEVEL = {header1: 1, header2: 2, header3: 3, header4: 4, header5: 5, header6: 6};
const manager = new ElementCommandManager();

// Inline descendants concatenate; block descendants retain their boundaries.
export const documentNodeText = node => {
  if (typeof node.text === 'string') return node.text;
  const children = node.children || [];
  return children.map(documentNodeText).join(
    children.some(child => ['paragraph', 'code_line', 'list_item'].includes(child.type)) ? '\n' : '');
};

/** Immutable, operation-specific projection of the command API's targets.
 * before_leaf_text is the complete block text, not an individual Slate leaf.
 * Text replacement hashes the exact subtree, including marks and leaf ids.
 */
export function buildDocumentContext({elements, version, fileUuid, documentIncarnation, snapshotId, projectionVersion = PROJECTION_VERSION}) {
  const outline = [];
  const blocks = [];
  const lists = [];
  const tables = [];
  const headers = [];
  const sectionPath = () => [{type: 'document', id: null}, ...headers.map(node => ({type: node.type, id: node.id}))];
  const visit = (node, parent, containers = []) => {
    if (!node || typeof node !== 'object' || typeof node.text === 'string') return;
    // Only root headings define the document section hierarchy.
    if (!parent && HEADER_LEVEL[node.type]) {
      while (headers.length && HEADER_LEVEL[headers[headers.length - 1].type] >= HEADER_LEVEL[node.type]) headers.pop();
      headers.push(node);
      outline.push({block_id: node.id, type: node.type, text: documentNodeText(node), level: HEADER_LEVEL[node.type]});
    }
    const ancestorPath = [...sectionPath(), ...containers];
    const base = {block_id: node.id, type: node.type, section_id: headers.length ? headers[headers.length - 1].id : null,
      ancestor_path: ancestorPath, container_path: containers, plain_text: documentNodeText(node)};
    try {
      if (TEXT_TYPES.has(node.type) || LIST_TYPES.has(node.type) ||
        ['title', 'subtitle', 'table_cell'].includes(node.type)) {
        canonicalReviewTarget({block_id: node.id, block_type: node.type, ancestor_path: ancestorPath});
      }
      const capabilities = manager.getCapabilities(node, parent);
      if (TEXT_TYPES.has(node.type) || ['title', 'subtitle', 'table_cell'].includes(node.type)) {
        const replace = capabilities.replace_block_text;
        const supported = replace.supported && replace.preserves_inline_format;
        const beforeHash = supported ? crypto.createHash('sha256').update(canonicalJsonDumps({
          kind: 'replace_block_text', file_uuid: fileUuid, document_incarnation: documentIncarnation,
          projection_version: projectionVersion, ancestor_path: ancestorPath, node,
        }), 'utf8').digest('hex') : null;
        const typeHash = capabilities.set_block_type.allowed_types.length ? setBlockTypeHash({
          blockId: node.id, blockType: node.type, ancestorPath, beforeLeafText: base.plain_text,
          fileUuid, documentIncarnation, projectionVersion,
        }) : null;
        blocks.push({...base, text_node_id: null, before_leaf_text: base.plain_text,
          canonical_before_hash: beforeHash, type_before_hash: typeHash,
          structure_before_hash: subtreeIdentityHash({node, ancestorPath, fileUuid, documentIncarnation, projectionVersion}),
          hash_algorithm: SHA256, hash_schema_version: CANONICAL_HASH_SCHEMA,
          supported, capabilities,
          unsupported_reason: supported ? null : replace.supported ? 'has_marks' : 'unsupported_content',
        });
      }
      if (LIST_TYPES.has(node.type)) {
        lists.push({...base, capabilities,
          canonical_before_hash: setListTypeHash({blockId: node.id, blockType: node.type, ancestorPath,
            fileUuid, documentIncarnation, projectionVersion}),
          structure_before_hash: subtreeIdentityHash({node, ancestorPath, fileUuid, documentIncarnation, projectionVersion}),
          items: (node.children || []).map(documentNodeText).filter(Boolean),
        });
      }
      if (node.type === 'table') {
        tables.push({...base, structure_before_hash: subtreeIdentityHash({node, ancestorPath, fileUuid, documentIncarnation, projectionVersion})});
      }
    } catch (error) {
      if (!(error instanceof CanonicalizationError)) throw error;
      logger.warn('SDoc Agent Context excludes target %s: %s', node.id, error.message);
      // Retain identity/text for scope resolution, but authorize no operation.
      const target = {...base, supported: false, capabilities: {}, unsupported_reason: 'canonicalization_failed'};
      if (LIST_TYPES.has(node.type)) {
        lists.push({...target, items: (node.children || []).map(documentNodeText).filter(Boolean)});
      } else if (TEXT_TYPES.has(node.type) || ['title', 'subtitle', 'table_cell'].includes(node.type)) {
        blocks.push(target);
      }
    }
    if (Array.isArray(node.children)) {
      const next = [...containers, {type: node.type, id: node.id}];
      // Inline internals are not command targets and do not own block descendants.
      if (!TEXT_TYPES.has(node.type) && !['title', 'subtitle', 'table_cell'].includes(node.type)) {
        node.children.forEach(child => visit(child, node, next));
      }
    }
  };
  (elements || []).forEach(node => visit(node, null));
  return {schema_version: 'sdoc-document-context/v1', snapshot_id: snapshotId, file_uuid: fileUuid,
    document_incarnation: documentIncarnation, exact_sdoc_version: version, projection_version: projectionVersion,
    outline, blocks, lists, tables};
}
