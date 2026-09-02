import deepCopy from 'deep-copy';
import { v4 } from 'uuid';
import { ELEMENT_COMMAND_LIMITS } from '../constants';
import { FIRST_LEVEL_ELEMENT_TYPES, STRUCTURAL_CHILD_TYPES } from '../models/normalize-element';
import { applyOperations } from '../utils/slate-utils';

const ROOT_TYPES = ['paragraph', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6', 'ordered_list', 'unordered_list'];
const LIST_TYPES = ['ordered_list', 'unordered_list'];
const TEXT_TYPES = ['paragraph', 'header1', 'header2', 'header3', 'header4', 'header5', 'header6'];
const REPLACE_TEXT_TYPES = ['title', ...TEXT_TYPES];
const INSERT_TYPES = [...TEXT_TYPES, ...LIST_TYPES, 'list_item'];
const HEADER_TYPES = ['header1', 'header2', 'header3', 'header4', 'header5', 'header6'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';

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
    if (!node || !isString(node.id) || byId.has(node.id)) {
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

const isTextLeaf = node => isObject(node) && isString(node.id) && isString(node.text) && !hasOwn(node, 'type') && !hasOwn(node, 'children');

const childrenAreSimpleText = node => Array.isArray(node.children) && node.children.length > 0 && node.children.every(isTextLeaf);

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
    if (!node || !isString(node.id) || ids.has(node.id)) return false;
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

const createElement = (type, text) => {
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
  return { id: v4(), type, children: [createTextNode(text)] };
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
    const elementIdMappings = {};
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

  resolveTarget(command, commandIndex, elements, clientRefs) {
    const hasId = hasOwn(command, 'target_element_id');
    const hasRef = hasOwn(command, 'target_ref');
    if (hasId === hasRef || (hasId && !isString(command.target_element_id)) || (hasRef && !isString(command.target_ref))) invalid(commandIndex);
    const id = hasId ? command.target_element_id : clientRefs.get(command.target_ref);
    if (!id) {
      if (hasRef) invalid(commandIndex);
      throw new ElementCommandError('element_not_found', commandIndex);
    }
    const index = buildIndex(elements);
    const target = index.byId.get(id);
    if (!target) throw new ElementCommandError('element_not_found', commandIndex);
    return target;
  }

  prepareInsert(command, commandIndex, elements, initialIds, clientRefs, operations, commandResults, elementIdMappings, afterAnchorInsertions, prependInsertions) {
    const allowedKeys = ['kind', 'client_ref', 'parent_element_id', 'parent_ref', 'before_element_id', 'after_element_id', 'position', 'payload'];
    if (Object.keys(command).some(key => !allowedKeys.includes(key)) || !isObject(command.payload)) invalid(commandIndex);
    const { type, text } = command.payload;
    if (!INSERT_TYPES.includes(type)) {
      throw new ElementCommandError('unsupported_element_type', commandIndex);
    }
    if (Object.keys(command.payload).some(key => !['type', 'text'].includes(key)) || (hasOwn(command.payload, 'text') && !isString(text))) invalid(commandIndex);
    if (TEXT_TYPES.includes(type) || type === 'list_item') {
      if (!isString(text)) invalid(commandIndex);
      if (byteLength(text) > ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES) throw new ElementCommandError('batch_limit_exceeded', commandIndex);
    }
    if (LIST_TYPES.includes(type) && hasOwn(command.payload, 'text') && byteLength(text) > ELEMENT_COMMAND_LIMITS.MAX_TEXT_BYTES) {
      throw new ElementCommandError('batch_limit_exceeded', commandIndex);
    }
    if (hasOwn(command, 'client_ref')) {
      if (!isString(command.client_ref) || !command.client_ref || clientRefs.has(command.client_ref)) invalid(commandIndex);
    }

    const hasParentId = hasOwn(command, 'parent_element_id');
    const hasParentRef = hasOwn(command, 'parent_ref');
    if (hasParentId === hasParentRef || (hasParentId && command.parent_element_id !== null && !isString(command.parent_element_id)) || (hasParentRef && !isString(command.parent_ref))) invalid(commandIndex);
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
      if (!isString(anchorId) || !initialIds.has(anchorId)) throw new ElementCommandError('invalid_anchor', commandIndex);
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

    const node = createElement(type, text);
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
    if (target.node.type === 'table_row' || target.node.type === 'table_cell' ||
      (target.node.type === 'group' && target.parent && ['table', 'table_row'].includes(target.parent.type))) {
      throw new ElementCommandError('unsupported_element_type', commandIndex);
    }
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
    const target = this.resolveTarget(command, commandIndex, elements, clientRefs);
    if (![...REPLACE_TEXT_TYPES, 'table_cell'].includes(target.node.type)) throw new ElementCommandError('unsupported_content', commandIndex);
    if (!childrenAreSimpleText(target.node)) throw new ElementCommandError('unsupported_content', commandIndex);
    const oldChildren = target.node.children;
    for (let index = oldChildren.length - 1; index >= 0; index--) {
      operations.push({ type: 'remove_node', path: [...target.path, index], node: deepCopy(oldChildren[index]) });
    }
    const textNode = createTextNode(command.payload.text);
    operations.push({ type: 'insert_node', path: [...target.path, 0], node: textNode });
    target.node.children = [textNode];
    commandResults.push({ command_index: commandIndex, target_element_id: target.node.id });
  }

  prepareUpdate(command, commandIndex, elements, clientRefs, operations, commandResults) {
    this.assertCommandKeys(command, commandIndex, ['kind', 'target_element_id', 'target_ref', 'payload']);
    if (!isObject(command.payload) || !isString(command.payload.type) || Object.keys(command.payload).length !== 1) invalid(commandIndex);
    const target = this.resolveTarget(command, commandIndex, elements, clientRefs);
    const oldType = target.node.type;
    const newType = command.payload.type;
    const textConversion = (oldType === 'paragraph' || HEADER_TYPES.includes(oldType)) && (newType === 'paragraph' || HEADER_TYPES.includes(newType));
    const listConversion = LIST_TYPES.includes(oldType) && LIST_TYPES.includes(newType);
    if (!textConversion && !listConversion) throw new ElementCommandError('unsupported_element_type', commandIndex);
    if (!isAllowedChild(target.parent, newType)) throw new ElementCommandError('invalid_parent_child', commandIndex);
    target.node.type = newType;
    operations.push({ type: 'set_node', path: target.path, properties: { type: oldType }, newProperties: { type: newType } });
    commandResults.push({ command_index: commandIndex, target_element_id: target.node.id });
  }

  assertCommandKeys(command, commandIndex, allowedKeys) {
    if (Object.keys(command).some(key => !allowedKeys.includes(key))) invalid(commandIndex);
  }
}

export default ElementCommandManager;
