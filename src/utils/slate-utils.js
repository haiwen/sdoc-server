import { Transforms } from "slate";
import logger from "../loggers";

export const applyOperations = (document, operations) => {
  const { version, children } = document;
  const editor = { children };

  operations.forEach(item => {
    try {
      Transforms.transform(editor, item);
    } catch(err) {
      logger.error(err.message);
      logger.error('sync operations failed.');
      return false;
    }
  });
  
  const newVersion = version + 1;
  document.setValue(editor.children, newVersion);
  return true;
};
