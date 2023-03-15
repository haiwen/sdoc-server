import md5 from "md5";
import fs from 'fs';
import { v4 } from "uuid";
import seaServerAPI from "../api/sea-server-api";
import { deleteDir, generateDefaultFileContent } from "../utils";
import logger from "../loggers";
import { SAVE_INTERVAL } from "../config/config";

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
    return new DocumentManager();
  };

  startSaveTimer = () => {
    this.saveTimer = setInterval(() => {
      this.saveAllDocs();
    }, SAVE_INTERVAL);

    process.on('SIGTERM', () => {
      logger.info('Exiting server process:', process.pid);
      this.saveAllDocs();
      setInterval(() => {
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
      const meta = document.getMate();
      if (meta.isSaving | !meta.need_save) { // is saving or no need save
        continue;
      }
      try {
        // todo
        const { token, repoID, filePath, fileName, value: fileContent } = document;
        await this.saveFile(token, repoID, filePath, fileName, fileContent);
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

  getFile = async (token, repoID, filePath) => {
    // TODO
    const docId = md5(filePath);
    const document = this.documents.get(docId);
    if (document) return document;
    
    const result = await seaServerAPI.getFileContent(token, repoID, filePath);
    const fileContent = result.data ? result.data : generateDefaultFileContent();
    // todo
    const doc = new Document(docId, fileContent, token, repoID, filePath);
    this.documents.set(docId, doc);
    return doc;
  };

  saveFile = async (token, repoID, filePath, fileName, fileContent) => {
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, fileContent, { flag: 'w+' });
    try {
      await seaServerAPI.saveFileContent(token, repoID, filePath, fileName, {path: tempPath});
      deleteDir(tempPath);
    } catch(err) {
      deleteDir(tempPath);
      throw new Error(err);
    }
  };

  serializeFile = () => {

  };

}

export default DocumentManager;
