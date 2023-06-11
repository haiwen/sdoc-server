import { Transforms } from "@seafile/slate";
import logger from "../loggers";

export const applyOperations = (document, operations, user, selection, cursorData) => {
  const { version, children } = document;
  const editor = { children };
  // const normalOperations = operations.filter(operation => operation.type !== 'set_selection');
  
  // sync operation
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (op.type === 'set_selection') {
      continue;
    }

    try {
      Transforms.applyToDraft(editor, null, op);
    } catch(err) {
      logger.error(err.message);
      logger.error('sync operations failed.');
    }
  }

  // update cursors
  document.setCursor(operations, user, selection, cursorData);
  
  const newVersion = version + 1;
  document.setLastModifyUser(user);
  document.setValue(editor.children, newVersion);
  return true;
};
