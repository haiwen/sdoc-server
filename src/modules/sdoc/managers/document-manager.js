import fs from 'fs';
import { v4 } from "uuid";
import deepCopy from 'deep-copy';
import { SAVE_INTERVAL, SEAHUB_SERVER } from "../../../config/config";
import logger from "../../../loggers";
import { deleteDir, getErrorMessage, errorHandle } from "../../../utils";
import seaServerAPI from "../api/sea-server-api";
import { DOC_CACHE_TIME } from '../constants';
import Document from '../models/document';
import { generateDefaultDocContent, isSdocContentValid, normalizeChildren } from '../models/document-utils';
import { applyOperations } from '../utils/slate-utils';
import { listPendingOperationsByDoc } from '../dao/operation-log';
import OperationsManager from './operations-manager';
import UsersManager from './users-manager';
import ElementCommandManager from './element-command-manager';

class DocumentManager {

  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();
    this.documentWriteQueues = new Map();

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
    let unsavedDocs = [];
    const startTime = Date.now();
    const docUuids = this.documents.keys();
    for (let docUuid of docUuids) {
      // Save document
      const saveFlag = await this.saveDoc(docUuid);
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

    await this.removeDocsWithNoAccess(unsavedDocs);
  };

  reloadDoc = async (docUuid, docName) => {
    return this.enqueueDocumentWrite(docUuid, async () => {
      this.removeDocFromMemoryUnsafe(docUuid);

      let result = null;
      try {
        result = await seaServerAPI.getDocContent(docUuid);
      } catch (err) {
        errorHandle(err);
        const error = new Error('The content of the document loaded error');
        error.error_type = 'content_load_invalid';
        error.from_url = `${SEAHUB_SERVER}/api/v2.1/seadoc/content/${docUuid}/`;
        throw error;
      }

      const docContent = result.data ? result.data : generateDefaultDocContent(docName);
      if (!isSdocContentValid(docContent)) {
        const error = new Error('The content of the document does not conform to the sdoc specification');
        error.error_type = 'content_invalid';
        throw error;
      }
      const doc = new Document(docUuid, docName, docContent);

      this.documents.set(docUuid, doc);
      return doc.toJson();
    });
  };

  getDoc = async (docUuid, docName, docTitle, username) => {
    const document = this.documents.get(docUuid);
    if (document) {
      return document.toJson();
    }

    const loadResult = await this.enqueueDocumentWrite(docUuid, async () => {
      const currentDocument = this.documents.get(docUuid);
      if (currentDocument) {
        return { document: currentDocument, shouldSave: false };
      }

      let result = null;
      try {
        result = await seaServerAPI.getDocContent(docUuid);
      } catch (err) {
        errorHandle(err);
        const error = new Error('The content of the document loaded error');
        error.error_type = 'content_load_invalid';
        error.from_url = `${SEAHUB_SERVER}/api/v2.1/seadoc/content/${docUuid}/`;
        throw error;
      }

      const docContent = result.data ? result.data : generateDefaultDocContent(docTitle, username);
      if (!isSdocContentValid(docContent)) {
        const error = new Error('The content of the document does not conform to the sdoc specification');
        error.error_type = 'content_invalid';
        throw error;
      }
      const loadedDocument = new Document(docUuid, docName, docContent);

      // apply pending operations
      const results = await listPendingOperationsByDoc(docUuid, loadedDocument.version);
      if (results.length) {
        logger.info(`doc ${docName}(${docUuid}) re-execute ${results.length} pending operations`);
        this.applyPendingOperations(loadedDocument, results);
      }

      this.documents.set(docUuid, loadedDocument);
      if (!result.data) {
        loadedDocument.setMeta({need_save: true});
      }
      return { document: loadedDocument, shouldSave: !result.data };
    });

    // Saving outside the queue prevents a 404 removal from waiting on itself.
    if (loadResult.shouldSave) {
      await this.saveDoc(docUuid);
    }
    return loadResult.document.toJson();
  };

  saveDoc = async (docUuid) => {
    const document = this.documents.get(docUuid);
    // The save function is an asynchronous function, which does not affect the normal execution of other programs,
    // and there is a possibility that the file has been deleted when the next file is saved
    if (!document) {
      logger.info(`SDoc ${docUuid} has been removed from memory`);
      return Promise.resolve(false);
    }
    const meta = document.getMeta();
    if (meta.is_saving || !meta.need_save) { // is saving
      return Promise.resolve(false);
    }

    document.setMeta({is_saving: true});

    // Save a stable version snapshot without holding the document write queue.
    const { version, format_version, elements, docName, last_modify_user = '' } = document;
    const savingVersion = version;
    const docContent = { version, format_version, elements: deepCopy(elements), last_modify_user };

    let saveFlag = false;
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, JSON.stringify(docContent), { flag: 'w+' });
    try {
      await seaServerAPI.saveDocContent(docUuid, {path: tempPath}, docContent.last_modify_user);
      saveFlag = true;
      logger.info(`${docName}(${docUuid}) saved`);
    } catch(err) {
      saveFlag = false;
      const message = getErrorMessage(err);
      if (message.status && message.status === 404) {
        logger.info(`${docName}(${docUuid}) save failed`);
        logger.info(JSON.stringify(message));
        await this.removeDoc(docUuid);
      } else {
        logger.error(`${docName}(${docUuid}) save failed`);
        logger.error(JSON.stringify(message));
      }
    } finally {
      deleteDir(tempPath);
      document.setMeta({is_saving: false});

      const currentDocument = this.documents.get(docUuid);
      if (currentDocument === document) {
        if (saveFlag && currentDocument.version === savingVersion) {
          currentDocument.setMeta({need_save: false});
        } else if (!saveFlag) {
          currentDocument.setMeta({need_save: true});
        }
      }
    }

    return Promise.resolve(saveFlag);
  };

  removeDoc = async (docUuid) => {
    return this.removeDocFromMemory(docUuid);
  };

  removeDocFromMemory = async (docUuid) => {
    return this.enqueueDocumentWrite(docUuid, async () => this.removeDocFromMemoryUnsafe(docUuid));
  };

  removeDocFromMemoryUnsafe = (docUuid) => {
    if (this.documents.has(docUuid)) {
      logger.info('Removed doc ', docUuid, ' from memory');
      const operationsManager = OperationsManager.getInstance();
      operationsManager.clearOperations(docUuid);
      this.documents.delete(docUuid);
    }
    return true;
  };

  isDocInMemory = (docUuid) => {
    return this.documents.has(docUuid);
  };

  getDocument = (docUuid) => {
    return this.documents.get(docUuid);
  };

  enqueueDocumentWrite = (docUuid, task) => {
    const previous = this.documentWriteQueues.get(docUuid) || Promise.resolve();
    const taskPromise = previous.catch(() => {}).then(task);
    const queueTail = taskPromise.catch(() => {});

    this.documentWriteQueues.set(docUuid, queueTail);
    queueTail.then(() => {
      if (this.documentWriteQueues.get(docUuid) === queueTail) {
        this.documentWriteQueues.delete(docUuid);
      }
    });

    return taskPromise;
  };

  applyElementCommands = async (docUuid, docName, docTitle, username, request) => {
    // Keep the hot-cache path synchronous so this request takes its queue
    // position before a later Socket update for the same document.
    if (!this.documents.get(docUuid)) {
      await this.getDoc(docUuid, docName, docTitle, username);
    }

    return this.enqueueDocumentWrite(docUuid, async () => {
      const document = this.documents.get(docUuid);
      if (!document) {
        const error = new Error('Document is not available for element command execution');
        error.error_code = 'document_not_found';
        throw error;
      }

      const elementCommandManager = new ElementCommandManager();
      const plan = elementCommandManager.prepare(document, request);

      const version = document.version + 1;
      try {
        const operationsManager = OperationsManager.getInstance();
        await operationsManager.addOperations(docUuid, plan.operations, version, { username });
      } catch (err) {
        logger.error('Save element command operations to database error:', document.docUuid, plan.operations);
        const error = new Error('Save element command operations to database error');
        error.error_code = 'apply_failed';
        throw error;
      }

      document.setLastModifyUser({ username });
      document.setValue(plan.elements, version);
      return { version, plan };
    });
  };

  removeDocs(docUuids) {
    return Promise.all(docUuids.map(docUuid => this.removeDocFromMemory(docUuid)));
  }

  removeDocsWithNoAccess(docUuids) {
    const usersManager = UsersManager.getInstance();
    const evictionTasks = [];
    for (let i = 0; i < docUuids.length; i++) {
      const docUuid = docUuids[i];
      const users = usersManager.getDocUsers(docUuid);
      if (users.length > 0) {
        continue;
      }
      const document = this.documents.get(docUuid);
      if (!document) {
        continue;
      }
      const meta = document.getMeta();
      const currentTime = new Date().getTime();
      if (currentTime - meta.last_access > DOC_CACHE_TIME) {
        evictionTasks.push(this.enqueueDocumentWrite(docUuid, async () => {
          const currentDocument = this.documents.get(docUuid);
          if (currentDocument !== document || usersManager.getDocUsers(docUuid).length > 0) {
            return false;
          }

          const currentMeta = currentDocument.getMeta();
          if (new Date().getTime() - currentMeta.last_access <= DOC_CACHE_TIME) {
            return false;
          }

          this.removeDocFromMemoryUnsafe(docUuid);
          logger.info(`Regularly clear files that no one has accessed: ${docUuid}`);
          return true;
        }));
      }
    }
    return Promise.all(evictionTasks);
  }

  normalizeSdoc = async (docUuid) => {
    return this.enqueueDocumentWrite(docUuid, async () => {
      const document = this.documents.get(docUuid);
      document.elements = normalizeChildren(document.elements);
    });
  };

  execOperationsBySocket = async (params, docName) => {
    const { doc_uuid, version: clientVersion, operations, user } = params;

    if (!this.documents.get(doc_uuid)) {
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

    return this.enqueueDocumentWrite(doc_uuid, async () => {
      const document = this.documents.get(doc_uuid);
      if (!document) {
        return {
          success: false,
          error_type: 'document_not_found',
        };
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
        return result;
      }

      const draftDocument = {
        version: document.version,
        elements: deepCopy(document.elements),
        last_modify_user: document.last_modify_user,
        setLastModifyUser(draftUser = { username: '', name: '' }) {
          const { username = '', name = '' } = draftUser;
          this.last_modify_user = username.startsWith('anon_') ? (name || 'Anonymous') : username;
        },
        setValue(newElements, newVersion) {
          this.elements = newElements;
          this.version = newVersion;
        },
      };

      let isExecuteSuccess = false;
      try {
        isExecuteSuccess = applyOperations(draftDocument, deepCopy(operations), user);
      } catch (e) {
        logger.error('apply operations failed.', document.docUuid, operations);
      }

      if (!isExecuteSuccess) {
        return {
          success: false,
          error_type: 'execute_client_operations_error',
        };
      }

      try {
        const operationsManager = OperationsManager.getInstance();
        await operationsManager.addOperations(doc_uuid, operations, draftDocument.version, user);
      } catch(e) {
        logger.error('Save operations to database error:', document.docUuid, operations);
        return {
          success: false,
          error_type: 'save_operations_to_database_error',
        };
      }

      document.setLastModifyUser(user);
      document.setValue(draftDocument.elements, draftDocument.version);
      return {
        success: true,
        version: document.version,
      };
    });

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
