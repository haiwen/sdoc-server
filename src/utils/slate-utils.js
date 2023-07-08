import { Transforms } from "@seafile/slate";
import logger from "../loggers";

export const validNode = (node) => {
  let isNodeValid = true;
  let isNodeChildrenValid = true;

  if (!node.id) {
    isNodeValid = false;
  }

  if (node.children) {
    isNodeChildrenValid = node.children.every(child => validNode(child));
  }

  return isNodeValid && isNodeChildrenValid;
};

export const validExecuteOp = (op) => {
  const { type, node } = op;
  if (type !== 'insert_node') return true;
  return validNode(node);
};

export const applyOperations = (document, operations, user) => {
  const { version, children } = document;
  const editor = { children };  
  let isExecuteError = false;
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

  if (isExecuteError) {
    return false;
  }
  
  const newVersion = version + 1;
  document.setLastModifyUser(user);
  document.setValue(editor.children, newVersion);
  return true;
};
