import crypto from 'crypto';

/**
 * Canonicalization and digest helpers for the SDoc AI review protocol
 * (JavaScript mirror of the Python `sdoc_canonical` module).
 *
 * Rules (RFC 8785 JCS + NFC + SHA-256 lowercase hex) must produce byte-identical
 * digests across Seahub / Seafile AI (Python) and SDoc Server (Node).
 */

export const SHA256 = 'SHA-256';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NODE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SCHEMA_VERSION_RE = /^[a-z][a-z0-9-]{0,63}\/v[1-9][0-9]*$/;

const VALID_BLOCK_TYPES = new Set([
  'title', 'subtitle', 'paragraph',
  'header1', 'header2', 'header3', 'header4', 'header5', 'header6',
  'ordered_list', 'unordered_list', 'list_item',
  'table', 'table_row', 'table_cell',
]);
const VALID_ANCESTOR_TYPES = new Set([
  'document', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6',
  'ordered_list', 'unordered_list', 'list_item',
  'table', 'table_row', 'table_cell',
]);
const VALID_KINDS = new Set(['replace_block_text', 'set_block_type', 'set_list_type', 'replace_table_cell_text']);

export const CANONICAL_HASH_SCHEMA = 'sdoc-canonical/v1';
export const SELECTION_SCHEMA = 'sdoc-selection/v1';
export const APPLY_PAYLOAD_SCHEMA = 'sdoc-apply-payload/v1';
export const PROJECTION_VERSION = 'sdoc-agent-context/v1';

export class CanonicalizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

export function canonicalJsonDumps(value) {
  return JSON.stringify(sortKeys(value));
}

export function normalizeText(text) {
  if (typeof text !== 'string') {
    throw new CanonicalizationError('Expected a string, got ' + typeof text);
  }
  // Reject lone surrogates: round-trip through UTF-8 must be lossless.
  if (!isWellFormedUnicode(text)) {
    throw new CanonicalizationError('Invalid Unicode (lone surrogate) in text.');
  }
  return text.normalize('NFC');
}

function isWellFormedUnicode(text) {
  // Node 20 has String.prototype.isWellFormed.
  if (typeof text.isWellFormed === 'function') {
    return text.isWellFormed();
  }
  try {
    encodeURIComponent(text);
    return true;
  } catch (e) {
    return false;
  }
}

function sha256LowercaseHex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function validateUuid(value, field) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new CanonicalizationError('Invalid ' + field + ': ' + value);
  }
  return value;
}

function validateNodeId(value, field) {
  if (typeof value !== 'string' || !NODE_ID_RE.test(value)) {
    throw new CanonicalizationError('Invalid ' + field + ': ' + value);
  }
  return value;
}

function validateSchemaVersion(value, field) {
  if (typeof value !== 'string' || !SCHEMA_VERSION_RE.test(value)) {
    throw new CanonicalizationError('Invalid ' + field + ': ' + value);
  }
  return value;
}

function validateAncestorPath(ancestorPath) {
  if (!Array.isArray(ancestorPath) || ancestorPath.length < 1 || ancestorPath.length > 16) {
    throw new CanonicalizationError('Invalid ancestor_path.');
  }
  return ancestorPath.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new CanonicalizationError('Invalid ancestor_path entry.');
    }
    const keys = Object.keys(entry).sort();
    if (keys.join(',') !== 'id,type') {
      throw new CanonicalizationError('ancestor_path entry must contain only type and id.');
    }
    if (!VALID_ANCESTOR_TYPES.has(entry.type)) {
      throw new CanonicalizationError('Invalid ancestor_path type: ' + entry.type);
    }
    const id = entry.id === null ? null : validateNodeId(entry.id, 'ancestor_path.id');
    return {type: entry.type, id};
  });
}

function digestJson(obj) {
  return sha256LowercaseHex(canonicalJsonDumps(obj));
}

export function canonicalBeforeHash({
  blockId, textNodeId, blockType, ancestorPath, beforeLeafText,
  fileUuid, documentIncarnation,
  projectionVersion = PROJECTION_VERSION,
  hashSchemaVersion = CANONICAL_HASH_SCHEMA,
  kind = 'replace_block_text',
}) {
  if (!VALID_KINDS.has(kind)) {
    throw new CanonicalizationError('Invalid kind: ' + kind);
  }
  if (!VALID_BLOCK_TYPES.has(blockType)) {
    throw new CanonicalizationError('Invalid block_type: ' + blockType);
  }
  const obj = {
    hash_schema_version: validateSchemaVersion(hashSchemaVersion, 'hash_schema_version'),
    kind,
    file_uuid: validateUuid(fileUuid, 'file_uuid'),
    document_incarnation: validateUuid(documentIncarnation, 'document_incarnation'),
    block_id: validateNodeId(blockId, 'block_id'),
    text_node_id: validateNodeId(textNodeId, 'text_node_id'),
    block_type: blockType,
    ancestor_path: validateAncestorPath(ancestorPath),
    before_leaf_text: normalizeText(beforeLeafText),
    projection_version: validateSchemaVersion(projectionVersion, 'projection_version'),
  };
  return digestJson(obj);
}

export function setBlockTypeHash({blockId, blockType, ancestorPath, beforeLeafText, fileUuid, documentIncarnation, projectionVersion = PROJECTION_VERSION, hashSchemaVersion = CANONICAL_HASH_SCHEMA}) {
  if (!VALID_BLOCK_TYPES.has(blockType)) {
    throw new CanonicalizationError('Invalid block_type: ' + blockType);
  }
  const obj = {
    hash_schema_version: validateSchemaVersion(hashSchemaVersion, 'hash_schema_version'),
    kind: 'set_block_type',
    file_uuid: validateUuid(fileUuid, 'file_uuid'),
    document_incarnation: validateUuid(documentIncarnation, 'document_incarnation'),
    block_id: validateNodeId(blockId, 'block_id'),
    block_type: blockType,
    ancestor_path: validateAncestorPath(ancestorPath),
    before_leaf_text: normalizeText(beforeLeafText),
    projection_version: validateSchemaVersion(projectionVersion, 'projection_version'),
  };
  return digestJson(obj);
}

export function setListTypeHash({blockId, blockType, ancestorPath, fileUuid, documentIncarnation, projectionVersion = PROJECTION_VERSION, hashSchemaVersion = CANONICAL_HASH_SCHEMA}) {
  if (blockType !== 'ordered_list' && blockType !== 'unordered_list') {
    throw new CanonicalizationError('Invalid list block_type: ' + blockType);
  }
  const obj = {
    hash_schema_version: validateSchemaVersion(hashSchemaVersion, 'hash_schema_version'),
    kind: 'set_list_type',
    file_uuid: validateUuid(fileUuid, 'file_uuid'),
    document_incarnation: validateUuid(documentIncarnation, 'document_incarnation'),
    block_id: validateNodeId(blockId, 'block_id'),
    block_type: blockType,
    ancestor_path: validateAncestorPath(ancestorPath),
    projection_version: validateSchemaVersion(projectionVersion, 'projection_version'),
  };
  return digestJson(obj);
}

export function selectionDigest({taskId, cardRevision, changesetRevision, decisionKind, selectedChangeItemIds}) {
  if (decisionKind !== 'approved' && decisionKind !== 'rejected') {
    throw new CanonicalizationError('Invalid decision_kind: ' + decisionKind);
  }
  if (!Number.isInteger(cardRevision) || cardRevision < 0 || cardRevision > 2 ** 53 - 1) {
    throw new CanonicalizationError('Invalid card_revision.');
  }
  if (!Number.isInteger(changesetRevision) || changesetRevision < 0 || changesetRevision > 2 ** 53 - 1) {
    throw new CanonicalizationError('Invalid changeset_revision.');
  }
  if (!Array.isArray(selectedChangeItemIds) || selectedChangeItemIds.length === 0) {
    throw new CanonicalizationError('selected_change_item_ids must not be empty.');
  }
  const ids = selectedChangeItemIds.map(id => validateUuid(id, 'selected_change_item_ids[]'));
  ids.sort();
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new CanonicalizationError('Duplicate selected_change_item_id: ' + id);
    }
    seen.add(id);
  }
  return digestJson({
    schema_version: SELECTION_SCHEMA,
    task_id: validateUuid(taskId, 'task_id'),
    card_revision: cardRevision,
    changeset_revision: changesetRevision,
    decision_kind: decisionKind,
    selected_change_item_ids: ids,
  });
}

export function applyPayloadDigest({taskId, reviewDecisionId, cardRevision, changesetRevisionId, changesetRevision, selectionDigestValue, selectedItems}) {
  if (!Number.isInteger(cardRevision) || cardRevision < 0 || cardRevision > 2 ** 53 - 1) {
    throw new CanonicalizationError('Invalid card_revision.');
  }
  if (!Number.isInteger(changesetRevision) || changesetRevision < 0 || changesetRevision > 2 ** 53 - 1) {
    throw new CanonicalizationError('Invalid changeset_revision.');
  }
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
    throw new CanonicalizationError('selected_items must be a non-empty list.');
  }
  const items = selectedItems.map(canonicalSelectedItem).sort((a, b) => a.item_id.localeCompare(b.item_id));
  return digestJson({
    schema_version: APPLY_PAYLOAD_SCHEMA,
    task_id: validateUuid(taskId, 'task_id'),
    review_decision_id: validateUuid(reviewDecisionId, 'review_decision_id'),
    card_revision: cardRevision,
    changeset_revision_id: validateUuid(changesetRevisionId, 'changeset_revision_id'),
    changeset_revision: changesetRevision,
    selection_digest: selectionDigestValue,
    selected_items: items,
  });
}

function canonicalSelectedItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new CanonicalizationError('Invalid selected item.');
  }
  if (!VALID_KINDS.has(item.kind)) {
    throw new CanonicalizationError('Invalid item kind: ' + item.kind);
  }

  if (item.kind === 'set_block_type' || item.kind === 'set_list_type') {
    const keys = Object.keys(item).sort();
    if (keys.join(',') !== 'after_type,item_id,kind,precondition,target') {
      throw new CanonicalizationError('selected item has unknown or missing fields.');
    }
    const target = item.target;
    const targetKeys = Object.keys(target).sort();
    if (targetKeys.join(',') !== 'ancestor_path,block_id,block_type') {
      throw new CanonicalizationError('Invalid ' + item.kind + ' target.');
    }
    if (!VALID_BLOCK_TYPES.has(target.block_type)) {
      throw new CanonicalizationError('Invalid target block_type: ' + target.block_type);
    }
    if (!VALID_BLOCK_TYPES.has(item.after_type)) {
      throw new CanonicalizationError('Invalid after_type: ' + item.after_type);
    }
    const precondition = item.precondition;
    const preconditionKeys = Object.keys(precondition).sort();
    if (preconditionKeys.join(',') !== 'canonical_before_hash,hash_algorithm,hash_schema_version,projection_version') {
      throw new CanonicalizationError('Invalid ' + item.kind + ' precondition.');
    }
    return {
      item_id: validateUuid(item.item_id, 'item_id'),
      kind: item.kind,
      target: {
        block_id: validateNodeId(target.block_id, 'block_id'),
        block_type: target.block_type,
        ancestor_path: validateAncestorPath(target.ancestor_path),
      },
      precondition: {
        canonical_before_hash: precondition.canonical_before_hash,
        hash_algorithm: precondition.hash_algorithm,
        hash_schema_version: validateSchemaVersion(precondition.hash_schema_version, 'hash_schema_version'),
        projection_version: validateSchemaVersion(precondition.projection_version, 'projection_version'),
      },
      after_type: item.after_type,
    };
  }

  const keys = Object.keys(item).sort();
  if (keys.join(',') !== 'after_text,item_id,kind,precondition,target') {
    throw new CanonicalizationError('selected item has unknown or missing fields.');
  }
  const target = item.target;
  const targetKeys = Object.keys(target).sort();
  if (targetKeys.join(',') !== 'ancestor_path,block_id,block_type,text_node_id') {
    throw new CanonicalizationError('Invalid item target.');
  }
  if (!VALID_BLOCK_TYPES.has(target.block_type)) {
    throw new CanonicalizationError('Invalid target block_type: ' + target.block_type);
  }
  const precondition = item.precondition;
  const preconditionKeys = Object.keys(precondition).sort();
  if (preconditionKeys.join(',') !== 'before_leaf_text,canonical_before_hash,hash_algorithm,hash_schema_version,projection_version') {
    throw new CanonicalizationError('Invalid item precondition.');
  }
  return {
    item_id: validateUuid(item.item_id, 'item_id'),
    kind: item.kind,
    target: {
      block_id: validateNodeId(target.block_id, 'block_id'),
      text_node_id: validateNodeId(target.text_node_id, 'text_node_id'),
      block_type: target.block_type,
      ancestor_path: validateAncestorPath(target.ancestor_path),
    },
    precondition: {
      before_leaf_text: normalizeText(precondition.before_leaf_text),
      canonical_before_hash: precondition.canonical_before_hash,
      hash_algorithm: precondition.hash_algorithm,
      hash_schema_version: validateSchemaVersion(precondition.hash_schema_version, 'hash_schema_version'),
      projection_version: validateSchemaVersion(precondition.projection_version, 'projection_version'),
    },
    after_text: normalizeText(item.after_text),
  };
}
