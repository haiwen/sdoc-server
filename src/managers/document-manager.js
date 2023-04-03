import fs from 'fs';
import { v4 } from "uuid";
import { Editor, Transforms } from "slate";
import seaServerAPI from "../api/sea-server-api";
import { deleteDir, generateDefaultFileContent } from "../utils";
import logger from "../loggers";
import { SAVE_INTERVAL } from "../config/config";
import Document from '../models/document';

class DocumentManager {

  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();

    // save infos
    this.isSaving = false;
    this.lastSavingInfo = {};
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DocumentManager();
    return this.instance;
  };

  startSaveTimer = () => {
    this.saveTimer = setInterval(() => {
      this.saveAllDocs();
    }, SAVE_INTERVAL);

    process.on('SIGTERM', () => {
      logger.info('Exiting server process:', process.pid);
      this.saveAllDocs();
      setInterval(() => {
        clearInterval(this.saveTimer);
        process.kill(process.pid, 'SIGKILL');
      }, 10000);
    });
  };

  saveAllDocs = async () => {
    if (this.isSaving) {
      logger.info('Last save task not completed.');
      return;
    }

    this.isSaving = true;

    let savedDocs = [];
    const startTime = Date.now();
    const docIds = this.documents.keys();
    for (let docId of docIds) {
      const document = this.documents.get(docId);
      const meta = document.getMeta();
      if (meta.isSaving | !meta.need_save) { // is saving or no need save
        continue;
      }
      try {
        // todo
        const { filePath, fileName, version, children } = document;
        const fileContent = { version, children };
        await this.saveFile(docId, filePath, fileName, fileContent);
        savedDocs.push(docId);
      } catch (error) {
        // an error occurred while saving the file
        logger.error(error);
      }
    }

    // record saving message
    const count = savedDocs.length;
    logger.info(`${count} docs saved.`);

    this.isSaving = false;
    this.lastSavingInfo.count = count;
    this.lastSavingInfo.startTime = startTime;
    this.lastSavingInfo.endTime = Date.now();
  };

  getFile = async (fileUuid, filePath, fileName) => {
    const document = this.documents.get(fileUuid);
    if (document) {
      return {
        version: document.version,
        children: document.children,
      };
    }
    
    const result = await seaServerAPI.getFileContent(fileUuid);
    const fileContent = result.data ? result.data : generateDefaultFileContent();
    const doc = new Document(fileUuid, filePath, fileName, fileContent);
    this.documents.set(fileUuid, doc);
    return fileContent;
  };

  saveFile = async (fileUuid, filePath, fileName, fileContent) => {
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(fileContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveFileContent(fileUuid, filePath, fileName, {path: tempPath});
      deleteDir(tempPath);
    } catch(err) {
      logger.info(err);
      logger.info(err.message);
      deleteDir(tempPath);
      throw new Error(err);
    }
  };

  execOperationsBySocket = (params, callback) => {
    const documents = this.documents.values();
    const document = documents.next().value;

    // todo
    const { operations } = params;
    const { version, children } = document;
    let editor = { children: children };
    let isOpsExecuteErrored = false;
    Editor.withoutNormalizing(editor, () => {
      operations.forEach(item => {
        try {
          Transforms.transform(editor, item);
        } catch(err) {
          logger.error(err);
          logger.error('sync operations failed.');
          isOpsExecuteErrored = true;
        }
      });
    });
    if (isOpsExecuteErrored) {
      const result = {
        success: false,
        operations: operations
      };
      callback && callback(result);
      return;
    }

    const nextVersion = version + 1;
    document.setValue(editor.children, nextVersion);
    editor = null;
    const result = {
      success: true,
      version: nextVersion,
    };
    callback && callback(result);
  };

}

export default DocumentManager;
