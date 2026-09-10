import deepCopy from 'deep-copy';
import { v4 } from 'uuid';
import { ELEMENT_COMMAND_LIMITS } from '../constants';
import { FIRST_LEVEL_ELEMENT_TYPES, STRUCTURAL_CHILD_TYPES } from '../models/normalize-element';
import { applyOperations } from '../utils/slate-utils';

const ROOT_TYPES = [
  'paragraph',
  'header1',
  'header2',
  'header3',
  'header4',
  'header5',
  'header6',
  'ordered_list',
  'unordered_list',
  'blockquote',
  'callout',
  'check_list_item',
  'code_block',
];
const LIST_TYPES = ['ordered_list', 'unordered_list'];
const TEXT_TYPES = ['paragraph', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6'];
const BLOCK_CONTAINER_TYPES = ['blockquote', 'callout'];
const INSERT_TYPES = [...TEXT_TYPES, ...LIST_TYPES, 'list_item', ...BLOCK_CONTAINER_TYPES, 'check_list_item', 'code_block'];
const HEADER_TYPES = ['header1', 'header2', 'header3', 'header4', 'header5', 'header6'];
const HEADER_INLINE_TYPES = ['link', 'sdoc_link', 'file_link', 'wiki_link'];
const NON_ADDRESSABLE_ELEMENT_TYPES = ['code_line', 'table_row', 'table_cell', 'column'];
const MEDIA_ELEMENT_TYPES = ['image', 'image_block', 'video', 'file_view', 'embed_link'];
const CALLOUT_BACKGROUND_COLORS = [
  '#f1f3f6', '#e1e9fe', '#def0ff', '#e7f9ee', '#eaf7d6',
  '#fef7e0', '#fff1e8', '#ffe6e3', '#ffe9f2', '#fde8ff',
];
const CODE_LANGUAGES = [
  'plaintext', 'bash', 'css', 'c', 'cpp', 'csharp', 'go', 'html', 'javascript',
  'java', 'json', 'php', 'python', 'ruby', 'sql', 'swift', 'typescript', 'xml', 'yaml',
];
const CODE_WHITE_SPACES = ['nowrap', 'normal'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const isNonEmptyString = value => isString(value) && value.length > 0;

export class ElementCommandError extends Error {
  constructor(errorCode, commandIndex = null) {
    super(errorCode);
    this.error_code = errorCode;
    this.command_index = commandIndex;
  }
}

const invalid = commandIndex => {
  throw new ElementCommandError('invalid_request', commandIndex);
};

const byteLength = value => Buffer.byteLength(value, 'utf8');

const buildIndex = elements => {
  const byId = new Map();
  let valid = true;
  const visit = (node, path, parent) => {
    if (!node || !isNonEmptyString(node.id) || byId.has(node.id)) {
      valid = false;
      return;
    }
    byId.set(node.id, { node, path, parent });
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => visit(child, [...path, index], node));
    }
  };
  elements.forEach((element, index) => visit(element, [index], null));
  return { byId, valid };
};

const isTextLeaf = node => isObject(node) && isNonEmptyString(node.id) && isString(node.text) && !hasOwn(node, 'type') && !hasOwn(node, 'children');

const childrenAreSimpleText = node => Array.isArray(node.children) && node.children.length > 0 && node.children.every(isTextLeaf);

const childrenAreSimpleBlockContent = node => Array.isArray(node.children) && node.children.length === 1 &&
  node.children[0].type === 'paragraph' && childrenAreSimpleText(node.children[0]);

const childrenAreSimpleCode = node => Array.isArray(node.children) && node.children.length > 0 &&
  node.children.every(child => child.type === 'code_line' && childrenAreSimpleText(child));

const childrenAreValidForHeader = node => Array.isArray(node.children) && node.children.length > 0 &&
  node.children.every(child => isTextLeaf(child) || HEADER_INLINE_TYPES.includes(child.type));

const isAllowedChild = (parent, childType) => {
  if (!parent) return ROOT_TYPES.includes(childType);
  if (LIST_TYPES.includes(parent.type)) return childType === 'list_item';
  if (parent.type === 'list_item') return childType === 'paragraph' || LIST_TYPES.includes(childType);
  return false;
};

const validateDocument = elements => {
  if (!Array.isArray(elements) || elements.length === 0) return false;
  const ids = new Set();
  const visit = (node, parent, isRoot) => {
    if (!node || !isNonEmptyString(node.id) || ids.has(node.id)) return false;
    ids.add(node.id);
    if (hasOwn(node, 'text')) return isTextLeaf(node);
    if (!isString(node.type) || !Array.isArray(node.children) || node.children.length === 0) return false;
    if (isRoot && !FIRST_LEVEL_ELEMENT_TYPES.includes(node.type)) return false;
    const allowedChildTypes = STRUCTURAL_CHILD_TYPES[node.type];
    if (allowedChildTypes && !node.children.every(child => allowedChildTypes.includes(child.type))) return false;
    return node.children.every(child => visit(child, node, false));
  };
  return elements.every(element => visit(element, null, true));
};

const createTextNode = text => ({ id: v4(), text });

const createListItem = text => ({
  id: v4(),
  type: 'list_item',
  children: [{ id: v4(), type: 'paragraph', children: [createTextNode(text)] }],
});

const createParagraph = text => ({
  id: v4(),
  type: 'paragraph',
  children: [createTextNode(text)],
});

const createCodeLines = text => text.split(/\r\n|\r|\n/).map(line => ({
  id: v4(),
  type: 'code_line',
  children: [createTextNode(line)],
}));

const createElement = (type, payload) => {
  const { text } = payload;
  if (type === 'list_item') {
    return createListItem(text);
  }
  if (LIST_TYPES.includes(type)) {
    return {
      id: v4(),
      type,
      children: text === undefined ? [] : [createListItem(text)],
    };
  }
  if (type === 'blockquote') {
    return { id: v4(), type, children: [createParagraph(text)] };
  }
  if (type === 'callout') {
    return {
      id: v4(),
      type,
      style: { background_color: payload.background_color || '#fef7e0' },
      children: [createParagraph(text)],
    };
  }
  if (type === 'check_list_item') {
    return { id: v4(), type, checked: payload.checked || false, children: [createTextNode(text)] };
  }
  if (type === 'code_block') {
    return {
      id: v4(),
      type,
      language: payload.language || 'plaintext',
      style: { white_space: payload.white_space || 'nowrap' },
      children: createCodeLines(text),
    };
  }
  return { id: v4(), type, children: [createTextNode(text)] };
};

const replacementChildren = (type, text) => {
  if (BLOCK_CONTAINER_TYPES.includes(type)) return [createParagraph(text)];
  if (type === 'code_block') return createCodeLines(text);
  return [createTextNode(text)];
};

class ElementCommandManager {
  prepare(document, request) {
    if (!isObject(request) || !Array.isArray(request.commands)) {
      invalid(null);
    }
    if (Object.keys(request).some(key => key !== 'commands')) invalid(null);
    if (request.commands.length === 0) invalid(null);
    if (byteLength(JSON.stringify(request)) > ELEMENT_COMMAND_LIMITS.MAX_REQUEST_BYTES || request.commands.length > ELEMENT_COMMAND_LIMITS.MAX_COMMANDS) {
      throw new ElementCommandError('batch_limit_exceeded');
    }

    const elements = deepCopy(document.elements);
    const initialIndex = buildIndex(elements);
    if (!initialIndex.valid || !validateDocument(elements)) {
      throw new ElementCommandError('apply_failed');
    }

    const initialIds = new Set(initialIndex.byId.keys());
    const clientRefs = new Map();
    const operations = [];
    const commandResults = [];
    const elementIdMappings = Object.create(null);
    const afterAnchorInsertions = new Map();
    const prependInsertions = new Map();

    request.commands.forEach((command, commandIndex) => {
      if (!isObject(command) || !isString(command.kind)) invalid(commandIndex);
      switch (command.kind) {
        case 'insert_element':
          this.prepareInsert(command, commandIndex, elements, initialIds, clientRefs, operations, commandResults, elementIdMappings, afterAnchorInsertions, prependInsertions);
          break;
        case 'delete_element':
          this.prepareDelete(command, commandIndex, elements, clientRefs, operations, commandResults);
          break;
        case 'replace_element_content':
          this.prepareReplace(command, commandIndex, elements, clientRefs, operations, commandResults);
          break;
        case 'update_element_attributes':
          this.prepareUpdate(command, commandIndex, elements, clientRefs, operations, commandResults);
          break;
        default:
          throw new ElementCommandError('unsupported_element_type', commandIndex);
      }
    });

    if (!validateDocument(elements)) {
      throw new ElementCommandError('invalid_parent_child', request.commands.length - 1);
    }

    const slateDocument = {
      version: document.version,
      elements: deepCopy(document.elements),
      setLastModifyUser: () => {},
      setValue(newElements) {
        this.elements = newElements;
      },
    };
    if (!applyOperations(slateDocument, deepCopy(operations), { username: '' }) || !validateDocument(slateDocument.elements)) {
      throw new ElementCommandError('apply_failed');
    }

    return {
      operations,
      elements: slateDocument.elements,
      commandResults,
      elementIdMappings,
    };
  }

  resolveTarget(command, commandIndex, elements, clientRefs, unsupportedErrorCode = 'unsupported_element_type') {
    const hasId = hasOwn(command, 'target_element_id');
    const hasRef = hasOwn(command, 'target_ref');
    if (hasId === hasRef || (hasId && !isNonEmptyString(command.target_element_id)) || (hasRef && !isNonEmptyString(command.target_ref))) invalid(commandIndex);
    const id = hasId ? command.target_element_id : clientRefs.get(command.target_ref);
    if (!id) {
      if (hasRef) invalid(commandIndex);
      throw new ElementCommandError('element_not_found', commandIndex);
    }
    const index = buildIndex(elements);
    const target = index.byId.get(id);
    if (!target) throw new ElementCommandError('element_not_found', commandIndex);
    this.assertDirectlyAddressableTarget(target, commandIndex, unsupportedErrorCode);
    return target;
  }

  prepareInsert(command, commandIndex, elements, initialIds, clientRefs, operations, commandResults, elementIdMappings, afterAnchorInsertions, prependInsertions) {
    const allowedKeys = ['kind', 'client_ref', 'parent_element_id', 'parent_ref', 'before_element_id', 'after_element_id', 'position', 'payload'];
    if (Object.keys(command).some(key => !allowedKeys.includes(key)) || !isObject(command.payload)) invalid(commandIndex);
    const { type, text } = command.payload;
    if (!INSERT_TYPES.includes(type)) {
      throw new ElementCommandError('unsupported_element_type', commandIndex);
    }
    const allowedPayloadKeys = ['type', 'text'];
    if (type === 'callout') allowedPayloadKeys.push('background_color');
    if (type === 'check_list_item') allowedPayloadKeys.push('checked');
    if (type === 'code_block') allowedPayloadKeys.push('language', 'white_space');
    if (Object.keys(command.payload).some(key => !allowedPayloadKeys.includes(key)) || (hasOwn(command.payload, 'text') && !isString(text))) invalid(commandIndex);
    if (TEXT_TYPES.includes(type) || type === 'list_item' || BLOCK_CONTAINER_TYPES.includes(type) || type === 'check_list_item' || type === 'code_block') {
      if (!isString(text)) invalid(commandIndex);
      if (byteLength(text) > ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES) throw new ElementCommandError('batch_limit_exceeded', commandIndex);
    }
    if (LIST_TYPES.includes(type) && hasOwn(command.payload, 'text') && byteLength(text) > ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES) {
      throw new ElementCommandError('batch_limit_exceeded', commandIndex);
    }
    if (type === 'callout' && hasOwn(command.payload, 'background_color') && !CALLOUT_BACKGROUND_COLORS.includes(command.payload.background_color)) invalid(commandIndex);
    if (type === 'check_list_item' && hasOwn(command.payload, 'checked') && typeof command.payload.checked !== 'boolean') invalid(commandIndex);
    if (type === 'code_block') {
      if (hasOwn(command.payload, 'language') && !CODE_LANGUAGES.includes(command.payload.language)) invalid(commandIndex);
      if (hasOwn(command.payload, 'white_space') && !CODE_WHITE_SPACES.includes(command.payload.white_space)) invalid(commandIndex);
    }
    if (hasOwn(command, 'client_ref')) {
      if (!isString(command.client_ref) || !command.client_ref || clientRefs.has(command.client_ref)) invalid(commandIndex);
    }

    const hasParentId = hasOwn(command, 'parent_element_id');
    const hasParentRef = hasOwn(command, 'parent_ref');
    if (hasParentId === hasParentRef || (hasParentId && command.parent_element_id !== null && !isNonEmptyString(command.parent_element_id)) || (hasParentRef && !isNonEmptyString(command.parent_ref))) invalid(commandIndex);
    const parentId = hasParentRef ? clientRefs.get(command.parent_ref) : command.parent_element_id;
    if (hasParentRef && !parentId) invalid(commandIndex);
    const index = buildIndex(elements);
    const parent = parentId === null ? null : index.byId.get(parentId);
    if (parentId !== null && !parent) throw new ElementCommandError('element_not_found', commandIndex);
    if (!isAllowedChild(parent && parent.node, type)) throw new ElementCommandError('invalid_parent_child', commandIndex);

    const positionCount = [hasOwn(command, 'before_element_id'), hasOwn(command, 'after_element_id'), hasOwn(command, 'position')].filter(Boolean).length;
    if (positionCount !== 1) invalid(commandIndex);
    const siblings = parent ? parent.node.children : elements;
    let insertIndex;
    const parentPath = parent ? parent.path : [];
    const parentKey = parent ? parent.node.id : '__root__';
    if (hasOwn(command, 'position')) {
      if (command.position !== 'prepend' && command.position !== 'append') invalid(commandIndex);
      if (command.position === 'prepend') {
        const insertedIds = prependInsertions.get(parentKey) || new Set();
        insertIndex = 0;
        while (insertIndex < siblings.length && insertedIds.has(siblings[insertIndex].id)) {
          insertIndex++;
        }
        prependInsertions.set(parentKey, insertedIds);
      } else {
        insertIndex = siblings.length;
      }
    } else {
      const anchorId = hasOwn(command, 'before_element_id') ? command.before_element_id : command.after_element_id;
      if (!isNonEmptyString(anchorId) || !initialIds.has(anchorId)) throw new ElementCommandError('invalid_anchor', commandIndex);
      const anchor = index.byId.get(anchorId);
      if (!anchor || anchor.parent !== (parent && parent.node)) throw new ElementCommandError('invalid_anchor', commandIndex);
      const anchorIndex = siblings.indexOf(anchor.node);
      if (hasOwn(command, 'before_element_id')) {
        insertIndex = anchorIndex;
      } else {
        const key = `${parentKey}:${anchorId}`;
        const insertedIds = afterAnchorInsertions.get(key) || new Set();
        insertIndex = anchorIndex + 1;
        while (insertIndex < siblings.length && insertedIds.has(siblings[insertIndex].id)) {
          insertIndex++;
        }
        afterAnchorInsertions.set(key, insertedIds);
      }
    }

    const node = createElement(type, command.payload);
    siblings.splice(insertIndex, 0, node);
    operations.push({ type: 'insert_node', path: [...parentPath, insertIndex], node: deepCopy(node) });
    if (hasOwn(command, 'position') && command.position === 'prepend') {
      prependInsertions.get(parentKey).add(node.id);
    }
    if (hasOwn(command, 'after_element_id')) {
      afterAnchorInsertions.get(`${parentKey}:${command.after_element_id}`).add(node.id);
    }
    if (hasOwn(command, 'client_ref')) {
      clientRefs.set(command.client_ref, node.id);
      elementIdMappings[command.client_ref] = node.id;
    }
    commandResults.push({ command_index: commandIndex, target_element_id: node.id, ...(hasOwn(command, 'client_ref') ? { client_ref: command.client_ref } : {}) });
  }

  prepareDelete(command, commandIndex, elements, clientRefs, operations, commandResults) {
    this.assertCommandKeys(command, commandIndex, ['kind', 'target_element_id', 'target_ref']);
    const target = this.resolveTarget(command, commandIndex, elements, clientRefs);
    if (!target.parent) {
      elements.splice(target.path[0], 1);
    } else {
      target.parent.children.splice(target.path[target.path.length - 1], 1);
    }
    operations.push({ type: 'remove_node', path: target.path, node: deepCopy(target.node) });
    commandResults.push({ command_index: commandIndex, target_element_id: target.node.id });
  }

  prepareReplace(command, commandIndex, elements, clientRefs, operations, commandResults) {
    this.assertCommandKeys(command, commandIndex, ['kind', 'target_element_id', 'target_ref', 'payload']);
    if (!isObject(command.payload) || !isString(command.payload.text) || Object.keys(command.payload).length !== 1) invalid(commandIndex);
    if (byteLength(command.payload.text) > ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES) throw new ElementCommandError('batch_limit_exceeded', commandIndex);
    const target = this.resolveTarget(command, commandIndex, elements, clientRefs, 'unsupported_content');
    if (MEDIA_ELEMENT_TYPES.includes(target.node.type)) throw new ElementCommandError('unsupported_content', commandIndex);
    const isSimpleTextTarget = (TEXT_TYPES.includes(target.node.type) || target.node.type === 'check_list_item') && childrenAreSimpleText(target.node);
    const isSimpleBlockTarget = BLOCK_CONTAINER_TYPES.includes(target.node.type) && childrenAreSimpleBlockContent(target.node);
    const isSimpleCodeTarget = target.node.type === 'code_block' && childrenAreSimpleCode(target.node);
    if (!isSimpleTextTarget && !isSimpleBlockTarget && !isSimpleCodeTarget) throw new ElementCommandError('unsupported_content', commandIndex);
    const oldChildren = target.node.children;
    for (let index = oldChildren.length - 1; index >= 0; index--) {
      operations.push({ type: 'remove_node', path: [...target.path, index], node: deepCopy(oldChildren[index]) });
    }
    const newChildren = replacementChildren(target.node.type, command.payload.text);
    newChildren.forEach((node, index) => {
      operations.push({ type: 'insert_node', path: [...target.path, index], node: deepCopy(node) });
    });
    target.node.children = newChildren;
    commandResults.push({ command_index: commandIndex, target_element_id: target.node.id });
  }

  prepareUpdate(command, commandIndex, elements, clientRefs, operations, commandResults) {
    this.assertCommandKeys(command, commandIndex, ['kind', 'target_element_id', 'target_ref', 'payload']);
    if (!isObject(command.payload) || Object.keys(command.payload).length === 0) invalid(commandIndex);
    const target = this.resolveTarget(command, commandIndex, elements, clientRefs);
    const oldType = target.node.type;
    if (MEDIA_ELEMENT_TYPES.includes(oldType)) throw new ElementCommandError('unsupported_element_type', commandIndex);
    if (hasOwn(command.payload, 'type')) {
      if (!isString(command.payload.type) || Object.keys(command.payload).length !== 1) invalid(commandIndex);
      const newType = command.payload.type;
      const textConversion = (oldType === 'paragraph' || HEADER_TYPES.includes(oldType)) && (newType === 'paragraph' || HEADER_TYPES.includes(newType));
      const listConversion = LIST_TYPES.includes(oldType) && LIST_TYPES.includes(newType);
      if (!textConversion && !listConversion) throw new ElementCommandError('unsupported_element_type', commandIndex);
      if (!isAllowedChild(target.parent, newType)) throw new ElementCommandError('invalid_parent_child', commandIndex);
      if (HEADER_TYPES.includes(newType) && !childrenAreValidForHeader(target.node)) {
        throw new ElementCommandError('unsupported_content', commandIndex);
      }
      target.node.type = newType;
      operations.push({ type: 'set_node', path: target.path, properties: { type: oldType }, newProperties: { type: newType } });
    } else if (oldType === 'check_list_item') {
      if (Object.keys(command.payload).length !== 1 || typeof command.payload.checked !== 'boolean') invalid(commandIndex);
      const oldChecked = target.node.checked || false;
      target.node.checked = command.payload.checked;
      operations.push({ type: 'set_node', path: target.path, properties: { checked: oldChecked }, newProperties: { checked: command.payload.checked } });
    } else if (oldType === 'callout') {
      if (Object.keys(command.payload).length !== 1 || !CALLOUT_BACKGROUND_COLORS.includes(command.payload.background_color)) invalid(commandIndex);
      const oldStyle = isObject(target.node.style) ? deepCopy(target.node.style) : {};
      const newStyle = { ...oldStyle, background_color: command.payload.background_color };
      target.node.style = newStyle;
      operations.push({ type: 'set_node', path: target.path, properties: { style: oldStyle }, newProperties: { style: newStyle } });
    } else if (oldType === 'code_block') {
      if (Object.keys(command.payload).some(key => !['language', 'white_space'].includes(key))) invalid(commandIndex);
      if (hasOwn(command.payload, 'language') && !CODE_LANGUAGES.includes(command.payload.language)) invalid(commandIndex);
      if (hasOwn(command.payload, 'white_space') && !CODE_WHITE_SPACES.includes(command.payload.white_space)) invalid(commandIndex);
      const properties = {};
      const newProperties = {};
      if (hasOwn(command.payload, 'language')) {
        properties.language = target.node.language || 'plaintext';
        newProperties.language = command.payload.language;
        target.node.language = command.payload.language;
      }
      if (hasOwn(command.payload, 'white_space')) {
        const oldStyle = isObject(target.node.style) ? deepCopy(target.node.style) : {};
        const newStyle = { ...oldStyle, white_space: command.payload.white_space };
        properties.style = oldStyle;
        newProperties.style = newStyle;
        target.node.style = newStyle;
      }
      operations.push({ type: 'set_node', path: target.path, properties, newProperties });
    } else {
      throw new ElementCommandError('unsupported_element_type', commandIndex);
    }
    commandResults.push({ command_index: commandIndex, target_element_id: target.node.id });
  }

  assertCommandKeys(command, commandIndex, allowedKeys) {
    if (Object.keys(command).some(key => !allowedKeys.includes(key))) invalid(commandIndex);
  }

  assertDirectlyAddressableTarget(target, commandIndex, unsupportedErrorCode) {
    // Text leaves and structural internals are managed through their owning element's command.
    const { node, parent } = target;
    if (isTextLeaf(node) || !isString(node.type) || NON_ADDRESSABLE_ELEMENT_TYPES.includes(node.type) ||
      (node.type === 'group' && parent && ['table', 'table_row'].includes(parent.type))) {
      throw new ElementCommandError(unsupportedErrorCode, commandIndex);
    }
  }
}

export default ElementCommandManager;
