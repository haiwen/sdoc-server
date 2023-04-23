import fs from 'fs';
import { v4 } from "uuid";
import seaServerAPI from "../api/sea-server-api";
import { deleteDir, generateDefaultDocContent } from "../utils";
import logger from "../loggers";
import { SAVE_INTERVAL } from "../config/config";
import Document from '../models/document';
import { applyOperations } from '../utils/slate-utils';

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
      }, SAVE_INTERVAL);
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
    const docUuids = this.documents.keys();
    for (let docUuid of docUuids) {
      const document = this.documents.get(docUuid);
      const meta = document.getMeta();
      if (meta.is_saving || !meta.need_save) { // is saving or no need save
        continue;
      }

      // Update save flag
      document.setMeta({is_saving: true});

      // Save document
      const { version, children } = document;
      const docContent = { version, children };
      const saveFlag = await this.saveDoc(docUuid, docContent);
      if (saveFlag) {
        // Reset save flag
        document.setMeta({is_saving: false, need_save: false});
        savedDocs.push(docUuid);
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

  getDoc = async (docUuid) => {
    const document = this.documents.get(docUuid);
    if (document) {
      return {
        version: document.version,
        children: document.children,
      };
    }
    const result = await seaServerAPI.getDocContent(docUuid);
    const docContent = result.data ? result.data : generateDefaultDocContent();
    const doc = new Document(docUuid, docContent);
    this.documents.set(docUuid, doc);
    return docContent;
  };

  saveDoc = async (docUuid, docContent) => {
    let saveFlag = false;
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(docContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveDocContent(docUuid, {path: tempPath});
      saveFlag = true;
      logger.info(`Doc ${docUuid} saved success`);
    } catch(err) {
      saveFlag = false;
      logger.error(`Saved doc ${docUuid} failed`);
      logger.error(err);
    } finally {
      deleteDir(tempPath);
    }
    return saveFlag;
  };

  execOperationsBySocket = (params, callback) => {
    const { doc_uuid, version: clientVersion, operations } = params;

    const document = this.documents.get(doc_uuid);
    const { version: serverVersion } = document;

    logger.debug('clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
    if (serverVersion !== clientVersion) {
      const result = {
        success: false,
        operations: operations
      };
      callback && callback(result);
      return;
    }

    // execute operations success
    if (applyOperations(document, operations)) {
      const result = {
        success: true,
        version: document.version,
      };
      callback && callback(result);
      return;
    }

    // execute operations failed
    const result = {
      success: false,
      operations: operations
    };
    callback && callback(result);
  };

}

export default DocumentManager;
