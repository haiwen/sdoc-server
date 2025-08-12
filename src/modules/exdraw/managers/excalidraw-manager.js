import fs from 'fs';
import { v4 } from "uuid";
import deepCopy from 'deep-copy';
import logger from "../../../loggers";
import { deleteDir, getErrorMessage } from "../../../utils";
import { SAVE_INTERVAL, SEAHUB_SERVER } from "../../../config/config";
import seaServerAPI from "../api/sea-server-api";
import { DOC_CACHE_TIME } from '../constants';
import ExcalidrawDocument from '../models/excalidraw-document';
import { isHasProperty } from '../utils';
import { syncElementsToCurrentDocument } from '../sync-utils';

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
      version: 0,
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
    if (!isHasProperty(docContent, 'version')) {
      docContent.version = 0;
    }
    const sceneData = new ExcalidrawDocument(exdrawUuid, exdrawName, docContent);
    sceneData.setLastModifyUser({username});
    this.documents.set(exdrawUuid, sceneData);

    if (!result.data) {
      sceneData.setMeta({need_save: true});
      await this.saveSceneDoc(exdrawUuid);
    }

    return sceneData.toJson();
  };

  saveSceneDoc = async (exdrawUuid) => {
    const document = this.documents.get(exdrawUuid);
    // The save function is an asynchronous function, which does not affect the normal execution of other programs,
    // and there is a possibility that the file has been deleted when the next file is saved
    if (!document) {
      logger.info(`excalidraw ${exdrawUuid} has been removed from memory`);
      return Promise.resolve(false);
    }

    const meta = document.getMeta();
    if (meta.is_saving || !meta.need_save) { // is saving
      return Promise.resolve(false);
    }

    document.setMeta({ is_saving: true });

    // Get save info
    const exdrawContent = document.toJson();
    const exdrawName = document.exdrawName;

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

  saveSceneDocToMemory = async (exdrawUuid, exdrawName, content, username) => {
    const document = this.documents.get(exdrawUuid);
    if (!document) {
      try {
        // Load the document before executing op to avoid the document not being loaded into the memory after disconnection and reconnection
        await this.getDoc(exdrawUuid, exdrawName);
      } catch(e) {
        logger.error(`SOCKET_MESSAGE: Load ${exdrawName}(${exdrawUuid}) doc content error`);
        const result = {
          success: false,
          error_type: 'load_document_content_error',
        };
        return Promise.resolve(result);
      }
    }

    const { version: clientVersion} = content;
    const { version: serverVersion, elements } = document;
    if (serverVersion !== clientVersion) {
      const result = {
        success: true,
        updated: false,
        version: serverVersion,
        elements: elements,
        error_type: 'version_behind_server',
      };
      logger.warn('Version do not match: clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
      return Promise.resolve(result);
    }

    const newVersion = clientVersion + 1;
    document.setLastModifyUser({ username });
    document.setValue(content.elements, newVersion);
    const result = {
      success: true,
      updated: true,
      version: document.version,
    };

    return Promise.resolve(result);
  };

  execOperationsBySocket = async (params, exdrawName) => {
    const { docUuid, version: clientVersion, user, elements } = params;
    const document = this.documents.get(docUuid);
    if (!document) {
      try {
        // Load the document before executing op to avoid the document not being loaded into the memory after disconnection and reconnection
        await this.getDoc(docUuid, exdrawName);
      } catch(e) {
        logger.error(`SOCKET_MESSAGE: Load ${exdrawName}(${docUuid}) doc content error`);
        const result = {
          success: false,
          error_type: 'load_document_content_error',
        };
        return Promise.resolve(result);
      }
    }

    const { version: serverVersion } = document;
    if (serverVersion !== clientVersion) {
      const result = {
        success: false,
        error_type: 'version_behind_server',
        elements: document.elements,
        version: serverVersion,
      };
      logger.warn('Version do not match: clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
      logger.warn('apply operations failed: sdoc uuid is %s, modified user is %s', document.docUuid, user.username);
      return Promise.resolve(result);
    }

        // execute operations success
    let isExecuteSuccess = false;
    try {
      // Prevent copying of references
      const newElements = deepCopy(elements);
      isExecuteSuccess = syncElementsToCurrentDocument(document, newElements, user);
    } catch (e) {
      logger.error('apply operations failed.', document.docUuid, elements);
      isExecuteSuccess = false;
    }

    if (!isExecuteSuccess) {
      const result = {
        success: false,
        error_type: 'execute_client_operations_error',
      };
      return Promise.resolve(result);
    }

    // execute operations success
    const result = {
      success: true,
      version: document.version,
    };
    return Promise.resolve(result);

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
