import { Transforms, Text, Node } from "@seafile/slate";
import deepCopy from 'deep-copy';
import logger from "../loggers";
import { FIRST_LEVEL_ELEMENT_TYPES } from "../models/normalize-element";

export const calculateAffectedBlocks = (operations) => {
  let blocks = [];
  operations.forEach(operation => {
    const { type } = operation;
    switch(type) {
      case 'insert_text':
      case 'remove_text':
      case 'insert_node':
      case 'remove_node':
      case 'merge_node':
      case 'set_node': {
        const { path } = operation;
        blocks.push(path[0]);
        break;
      }
      case 'split_node': {
        const { path } = operation;
        blocks.push(path[0]);
        blocks.push(path[0] + 1);
        break;
      }
      case 'move_node': {
        const { path, newPath } = operation;
        blocks.push(path[0]);
        blocks.push(newPath[0]);
        break;
      }
      default: {  // set_selection
        break;
      }
    }
  });
  // split_node and move_node may calculate the same block node
  return [...new Set(blocks)].sort((a, b) => a - b);
};

export const isNodeValid = (node, isTop = false) => {
  // The type of the first-level sub-element must exist and must be a top-level element
  if (isTop) {
    if (!node.type) return false;
    if (!FIRST_LEVEL_ELEMENT_TYPES.includes(node.type)) return false;
  }

  if (Text.isText(node)) return true;

  if (!node.children) return false;
  if (!Array.isArray(node.children)) return false;
  if (node.children.length === 0) return false; // node.children is empty array

  const isValid = node.children.every(child => isNodeValid(child));
  return isValid;
};

export const isNodeIdValid = (node) => {
  let isNodeValid = true;
  let isNodeChildrenValid = true;

  if (!node.id) {
    isNodeValid = false;
  }

  if (node.children) {
    isNodeChildrenValid = node.children.every(child => isNodeIdValid(child));
  }

  return isNodeValid && isNodeChildrenValid;
};

export const validExecuteOp = (op) => {
  const { type, node } = op;
  if (type !== 'insert_node') return true;
  return isNodeIdValid(node);
};

export const applyOperations = (document, operations, user) => {
  const { version, elements } = document;
  const editor = { children: elements };  
  let isExecuteError = false;
  // Calculate the top-level block associated with operations
  const blocks = calculateAffectedBlocks(operations);
  const oldNodeValues = blocks.map(block => {
    const node = editor.children[block];
    return {
      path: [block],
      node: deepCopy(node),
    };
  });

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (!validExecuteOp(op)) {
      isExecuteError = true;
      break;
    }

    try {
      Transforms.applyToDraft(editor, null, op);
    } catch(err) {
      isExecuteError = true;
      logger.error(err.message);
      logger.error('sync operation failed.', JSON.stringify(op));
    }
  }

  // Calculate whether the relevant block after executing the operations
  let isAffectedBlocksInvalid = false;
  const newNodeValues = blocks.map(block => {
    const node = editor.children[block];
    if (node && !isAffectedBlocksInvalid && !isNodeValid(node, true)) {
      isAffectedBlocksInvalid = true;
    }
    return {
      path: [block],
      node: node && deepCopy(node),
    };
  });

  if (isAffectedBlocksInvalid) {
    logger.error('Old node message: ', JSON.stringify(oldNodeValues));
    logger.error('Executed operations: ', JSON.stringify(operations));
    logger.error('New node message: ', JSON.stringify(newNodeValues));
    return false;
  }

  if (isExecuteError) {
    return false;
  }
  
  const newVersion = version + 1;
  document.setLastModifyUser(user);
  document.setValue(editor.children, newVersion);
  return true;
};

export const isEmptyNode = (node) => {
  const nodeChildren = node.children;
  const isSingleChild = nodeChildren.length === 1;
  const firstChild = nodeChildren[0];
  const isText = Text.isText(firstChild);
  let isEmptyContent = false;
  if (isText) {
    isEmptyContent = firstChild.text === '';
  } 

  let isEmpty = isSingleChild && isText && isEmptyContent;
  return isEmpty;
};
