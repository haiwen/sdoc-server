import fs from 'fs';
import { v4 } from "uuid";
import logger from "../../../loggers";
import { deleteDir, getErrorMessage } from "../../../utils";
import { SAVE_INTERVAL, SEAHUB_SERVER } from "../../../config/config";
import seaServerAPI from "../api/sea-server-api";
import { DOC_CACHE_TIME } from '../constants';
import ExcalidrawDocument from '../models/excalidraw-document';

class ExcalidrawManager {

  constructor() {
    this.instance = null;
    this.documents = new Map();
    // save infos
    this.isSaving = false;
    this.lastSavingInfo = {};
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new ExcalidrawManager();
    return this.instance;
  };

  startSaveTimer = () => {
    this.saveTimer = setInterval(() => {
      this.saveAllSceneDoc();
    }, SAVE_INTERVAL);

    process.on('SIGTERM', () => {
      logger.info('Exiting server process:', process.pid);
      this.saveAllSceneDoc();
      setInterval(() => {
        clearInterval(this.saveTimer);
        process.kill(process.pid, 'SIGKILL');
      }, SAVE_INTERVAL);
    });
  };

  saveAllSceneDoc = async () => {
    if (this.isSaving) {
      logger.info('Last save task not completed.');
      return;
    }

    this.isSaving = true;

    let savedDocs = [];
    let unsavedDocs = [];
    const startTime = Date.now();
    const docUuids = this.documents.keys();
    for (let docUuid of docUuids) {
      // Save document
      const saveFlag = await this.saveSceneDoc(docUuid);

      if (saveFlag) {
        savedDocs.push(docUuid);
      } else {
        unsavedDocs.push(docUuid);
      }
    }
    // record saving message
    const count = savedDocs.length;
    logger.info(`${count} docs saved.`);

    this.isSaving = false;
    this.lastSavingInfo.count = count;
    this.lastSavingInfo.startTime = startTime;
    this.lastSavingInfo.endTime = Date.now();
    this.removeDocsWithNoAccess(unsavedDocs);
  };

  getSceneDoc = async (exdrawUuid, exdrawName, username) => {
    const document = this.documents.get(exdrawUuid);
    if (document) {
      return document.toJson();
    }

    let downloadLink = '';
    try {
      const res = await seaServerAPI.getSceneDownloadLink(exdrawUuid);
      downloadLink = res.data.download_link;
    } catch (e) {
      const error = new Error('Get doc download link error');
      error.error_type = 'get_doc_download_link_error';
      error.from_url = `${SEAHUB_SERVER}/api/v2.1/exdraw/download-link/${exdrawUuid}/`;
      throw error;
    }

    let result = null;
    const defineSceneConfig = {
      elements: [],
    };
    try {
      result = await seaServerAPI.getSceneContent(downloadLink);
    } catch (e) {
      const error = new Error('The content of the document loaded error');
      error.error_type = 'content_load_invalid';
      error.from_url = downloadLink;
      throw error;
    }
    const docContent = result.data ? result.data : defineSceneConfig;
    const sceneData = new ExcalidrawDocument(exdrawUuid, exdrawName, docContent);
    sceneData.setLastModifyUser({username});
    this.documents.set(exdrawUuid, sceneData);

    if (!result.data) {
      sceneData.setMeta({need_save: true});
      await this.saveSceneDoc(exdrawUuid);
    }

    return sceneData.toJson();
  };

  saveSceneDoc = async (exdrawUuid, content) => {
    const document = this.documents.get(exdrawUuid);
    // The save function is an asynchronous function, which does not affect the normal execution of other programs,
    // and there is a possibility that the file has been deleted when the next file is saved
    if (!document && !content) {
      logger.info(`excalidraw ${exdrawUuid} has been removed from memory`);
      return Promise.resolve(false);
    }

    const meta = document.getMeta();
    if (meta.is_saving) { // is saving
      return Promise.resolve(false);
    }

    document.setMeta({ is_saving: true });

    // Get save info
    const { elements, exdrawName, last_modify_user = '' } = document;

    let tempContent;
    if (content) {
      tempContent = content;
      document.setValue(content.elements);
    } else {
      tempContent = { elements };
    }
    const exdrawContent = { ...tempContent, last_modify_user};
    let saveFlag = false;
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(exdrawContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveSceneContent(exdrawUuid, {path: tempPath}, exdrawContent.last_modify_user);
      saveFlag = true;
      logger.info(`${exdrawName}(${exdrawUuid}) saved`);
    } catch(err) {
      saveFlag = false;
      const message = getErrorMessage(err);
      if (message.status && message.status === 404) {
        logger.info(`${exdrawName}(${exdrawUuid}) save failed`);
        logger.info(JSON.stringify(message));
        await this.removeDoc(exdrawUuid);
      } else {
        logger.error(`${exdrawName}(${exdrawUuid}) save failed`);
        logger.error(JSON.stringify(message));
      }
    } finally {
      deleteDir(tempPath);
    }
    document.setMeta({is_saving: false, need_save: false});

    return Promise.resolve(saveFlag);
  };

  removeDocsWithNoAccess(docUuids) {
    for (let i = 0; i < docUuids.length; i++) {
      const docUuid = docUuids[i];

      const document = this.documents.get(docUuid);
      if (!document) {
        continue;
      }
      const meta = document.getMeta();
      const currentTime = new Date().getTime();
      if (currentTime - meta.last_access > DOC_CACHE_TIME) {
        this.removeDoc(docUuid);
        logger.info(`Regularly clear files that no one has accessed: ${docUuid}`);
      }
    }
  }

  removeDoc = async (docUuid) => {
    const removeFlag = await this.removeDocFromMemory(docUuid);
    return Promise.resolve(removeFlag);
  };

  removeDocFromMemory = async (docUuid) => {
    if (this.documents.has(docUuid)) {
      logger.info('Removed doc ', docUuid, ' from memory');
      this.documents.delete(docUuid);
    }
    return Promise.resolve(true);
  };

}

export default ExcalidrawManager;
