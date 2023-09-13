import fs from 'fs';
import { v4 } from "uuid";
import deepCopy from 'deep-copy';
import seaServerAPI from "../api/sea-server-api";
import { deleteDir } from "../utils";
import logger from "../loggers";
import { SAVE_INTERVAL } from "../config/config";
import Document from '../models/document';
import { applyOperations } from '../utils/slate-utils';
import { listPendingOperationsByDoc } from '../dao/operation-log';
import OperationsManager from './operations-manager';
import { generateDefaultDocContent, isSdocContentValid, normalizeChildren } from '../models/document-utils';

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
      // Save document
      const saveFlag = await this.saveDoc(docUuid);
      if (saveFlag) {
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

  getDoc = async (docUuid, docName) => {
    const document = this.documents.get(docUuid);
    if (document) {
      return document.toJson();
    }
    const result = await seaServerAPI.getDocContent(docUuid);
    const docContent = result.data ? result.data : generateDefaultDocContent(docName);
    if (!isSdocContentValid(docContent)) {
      const error = new Error('The content of the document does not conform to the sdoc specification');
      error.error_type = 'content_invalid';
      throw error;
    }
    const doc = new Document(docUuid, docName, docContent);

    // apply pending operations
    const results = await listPendingOperationsByDoc(docUuid, doc.version);
    if (results.length) {
      this.applyPendingOperations(doc, results);
    }

    this.documents.set(docUuid, doc);
    return doc.toJson();
  };

  saveDoc = async (docUuid, savedBySocket = false) => {
    const document = this.documents.get(docUuid);
    // The save function is an asynchronous function, which does not affect the normal execution of other programs,
    // and there is a possibility that the file has been deleted when the next file is saved
    if (!document) {
      logger.info(`SDoc ${docUuid} has been removed from memory`);
      return Promise.resolve(false);
    }
    const meta = document.getMeta();
    if (meta.is_saving || !meta.need_save) { // is saving or no need save
      return Promise.resolve(false);
    }
  
    document.setMeta({is_saving: true});

    // Get save info
    const { version, children, docName, last_modify_user } = document;
    const docContent = { version, children, last_modify_user };

    let saveFlag = false;
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(docContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveDocContent(docUuid, {path: tempPath}, docContent.last_modify_user);
      saveFlag = true;
      logger.info(`${savedBySocket ? 'Socket: ' : ''}${docUuid} saved`);
    } catch(err) {
      saveFlag = false;
      logger.error(`${savedBySocket ? 'Socket:' : ''}${docName}(${docUuid}) save failed`);
      logger.error(err);
    } finally {
      deleteDir(tempPath);
    }

    document.setMeta({is_saving: false, need_save: false});
    return Promise.resolve(saveFlag);
  };

  removeDocs(docUuids) {
    for (let docUuid of docUuids) {
      if (this.documents.has(docUuid)) {
        logger.info('Removed doc ', docUuid, ' from memory');
        this.documents.delete(docUuid);
      }
    }
  }

  normalizeSdoc = (docUuid) => {
    const document = this.documents.get(docUuid);
    document.children = normalizeChildren(document.children);
  };

  execOperationsBySocket = async (params, docName) => {
    const { doc_uuid, version: clientVersion, operations, user } = params;

    const document = this.documents.get(doc_uuid);
    if (!document) {
      try {
        // Load the document before executing op to avoid the document not being loaded into the memory after disconnection and reconnection
        await this.getDoc(doc_uuid, docName);
      } catch(e) {
        logger.error(`SOCKET_MESSAGE: Load ${docName}(${doc_uuid}) doc content error`);
        const result = {
          success: false,
          error_type: 'load_document_content_error',
        };
        return Promise.resolve(result);
      }
    }

    const { version: serverVersion } = document;
    if (serverVersion !== clientVersion) {
      const operationsManager = OperationsManager.getInstance(); 
      const loseOperations = await operationsManager.getLoseOperationList(doc_uuid, clientVersion);
      const result = {
        success: false,
        error_type: 'version_behind_server',
        lose_operations: loseOperations,
      };
      logger.warn('Version do not match: clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
      logger.warn('apply operations failed: sdoc uuid is %s, modified user is %s, execute operations %o', document.docUuid, user.username, operations);
      return Promise.resolve(result);
    }

    // execute operations success
    let isExecuteSuccess = false;
    try {
      // Prevent copying of references
      const dupOperations = deepCopy(operations);
      isExecuteSuccess = applyOperations(document, dupOperations, user);
    } catch (e) {
      logger.error('apply operations failed.', document.docUuid, operations);
      isExecuteSuccess = false;
    }
    
    // execute operations failed
    if (!isExecuteSuccess) {
      const result = {
        success: false,
        error_type: 'execute_client_operations_error',
      };
      return Promise.resolve(result);
    }

    if (isExecuteSuccess) {
      try {
        const operationsManager = OperationsManager.getInstance();
        await operationsManager.addOperations(doc_uuid, operations, document.version, user);
      } catch(e) {
        logger.error('Save operations to database error:', document.docUuid, operations);
        const result = {
          success: false,
          error_type: 'save_operations_to_database_error',
        };
        return Promise.resolve(result);
      }
    }

    // execute operations success
    const result = {
      success: true,
      version: document.version,
    };
    return Promise.resolve(result);

  };

  applyPendingOperations = (document, results) => {
    for (let result of results) {
      let operations = result.operations;
      operations = JSON.parse(operations);
      const version = result.op_id;
      const user = { username: result.author };
      let isExecuteSuccess = false;
      try {
        isExecuteSuccess = applyOperations(document, operations, user);
      } catch (e) {
        logger.error('apply pending operations failed.', document.docUuid, version, operations);
        isExecuteSuccess = false;
      }
      
      if (isExecuteSuccess) {
        document.version = version;
        document.meta.need_save = true;
      }
    }
  };

  setCursorLocation = (params) => {
    const { doc_uuid, user, location, cursor_data } = params;

    // sync document's cursors
    const document = this.documents.get(doc_uuid);
    document && document.setCursor(user, location, cursor_data);
  };

  deleteCursor = (docUuid, user) => {
    const document = this.documents.get(docUuid);
    document && document.deleteCursor(user);
  };

}

export default DocumentManager;
