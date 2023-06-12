import { Transforms } from "@seafile/slate";
import logger from "../loggers";

export const applyOperations = (document, operations, user) => {
  const { version, children } = document;
  const editor = { children };  
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    try {
      Transforms.applyToDraft(editor, null, op);
    } catch(err) {
      logger.error(err.message);
      logger.error('sync operations failed.');
    }
  }
  
  const newVersion = version + 1;
  document.setLastModifyUser(user);
  document.setValue(editor.children, newVersion);
  return true;
};

export const syncDocumentCursors = (document, operations, user, selection, cursorData) => {
  document.setCursor(operations, user, selection, cursorData);
  return true;
};
