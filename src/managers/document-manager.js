import fs from 'fs';
import { v4 } from "uuid";
import seaServerAPI from "../api/sea-server-api";
import { deleteDir, generateDefaultDocContent } from "../utils";
import logger from "../loggers";
import { SAVE_INTERVAL } from "../config/config";
import Document from '../models/document';
import { applyOperations } from '../utils/slate-utils';
import { listPendingOperationsByDoc } from '../dao/operation-log';
import OperationsManager from './operations-manager';
import { normalizeChildren } from '../models/document-utils';

class DocumentManager {

  // 文档属性：实例、用户、文档内容、保存的信息、是否保存中
  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();

    // save infos
    this.isSaving = false;
    this.lastSavingInfo = {};
  }

  // 获取文档实例（如果存在直接返回，如果不存在新建一个实例）
  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DocumentManager();
    return this.instance;
  };

  // 开始保存定时器
  startSaveTimer = () => {
    // 每隔5分钟，定时保存全部文档
    this.saveTimer = setInterval(() => {
      this.saveAllDocs();
    }, SAVE_INTERVAL);

    // 进程发送终止信号情报(SIGTERM),从而终止该进程。
    process.on('SIGTERM', () => {
      // 打印进程终止和进程的 pid
      logger.info('Exiting server process:', process.pid);
      // 保存全部文档
      this.saveAllDocs();
      // 这里为什么？当一个间隔后，清空定时器，立即终止进程，这里应该是 setTimeout 吧，不需要批量杀掉进程
      setInterval(() => {
        clearInterval(this.saveTimer);
        process.kill(process.pid, 'SIGKILL');
      }, SAVE_INTERVAL);
    });
  };

  // 保存全部文档
  saveAllDocs = async () => {
    // 如果正在保存中，不保存并写入日志
    if (this.isSaving) {
      logger.info('Last save task not completed.');
      return;
    }

    // 设置，正在保存中
    this.isSaving = true;

    let savedDocs = [];
    const startTime = Date.now();
    const docUuids = this.documents.keys();

    // 获取全部文档的 UUID    
    for (let docUuid of docUuids) {
      // Save document
      const saveFlag = await this.saveDoc(docUuid);
      if (saveFlag) {
        savedDocs.push(docUuid);
      }
    }

    // 这里记录保存的信息（保存了多少个文档）
    // record saving message
    const count = savedDocs.length;
    logger.info(`${count} docs saved.`);

    // 把保存信息写入最近保存信息中
    this.isSaving = false;
    this.lastSavingInfo.count = count;
    this.lastSavingInfo.startTime = startTime;
    this.lastSavingInfo.endTime = Date.now();
  };

  // 获取某个文档
  getDoc = async (docUuid, docName) => {

    // 从 sdoc-server 全部文档中，使用 UUID 获取某个文档
    const document = this.documents.get(docUuid);

    // 1、如果 sdoc-server 存在这个文档，返回文档的三个属性
    if (document) {
      return document.toJson();
    }

    // 2、如果 sdoc-server 不存在这个文档，从 seahub server 获取文档
    const result = await seaServerAPI.getDocContent(docUuid);

    // 如果 seahub 返回了值，直接使用；否则使用默认的 content (一个标题+一个内容)
    const docContent = result.data ? result.data : generateDefaultDocContent();

    // 使用返回值新建一个 doc 对象
    const doc = new Document(docUuid, docName, docContent);

    // 列出悬挂的操作，如果悬挂的操作大于0，那么直接执行悬挂的操作
    // 实际的场景是，用户新建了文档，此时还没有创建 doc，然后本地进行很多操作，就有悬挂的操作。
    // 等创建出 doc 然后需要执行悬挂的操作
    // apply pending operations
    // 这个返回值不合适，应该是 pendingOperations
    const results = await listPendingOperationsByDoc(docUuid, doc.version);
    if (results.length) {
      this.applyPendingOperations(doc, results);
    }

    // 把新建的文档保存到当前属性中
    this.documents.set(docUuid, doc);
    return doc.toJson();
  };

  saveDoc = async (docUuid, savedBySocket = false) => {
    const document = this.documents.get(docUuid);
    const meta = document.getMeta();
    if (meta.is_saving || !meta.need_save) { // is saving or no need save
      return Promise.resolve(false);
    }
  
    document.setMeta({is_saving: true});

    // Get save info
    const { version, children, docName, last_modify_user } = document;
    const docContent = { version, children, last_modify_user };

    let saveFlag = false;
    // 设置临时路径
    const tempPath = `/tmp/` + v4();
    // node 把客户端发送的文件内容，写入到临时路径中
    fs.writeFileSync(tempPath, JSON.stringify(docContent), { flag: 'w+' });

    // 保存到 seahub 服务器
    try {
      // 保存路径是临时目录
      await seaServerAPI.saveDocContent(docUuid, {path: tempPath}, docContent.last_modify_user);
      saveFlag = true;
      logger.info(`${savedBySocket ? 'Socket: ' : ''}${docUuid} saved`);
    } catch(err) {
      saveFlag = false;
      logger.error(`${savedBySocket ? 'Socket:' : ''}${docName}(${docUuid}) save failed`);
      logger.error(err);
    } finally {
      // 保存失败，然后删除目录
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

  execOperationsBySocket = (params, callback) => {
    const { doc_uuid, version: clientVersion, operations, user } = params;

    // 获取当前编辑的文档
    const document = this.documents.get(doc_uuid);
    const { version: serverVersion } = document;

    // 打印日志：客户端的版本，服务端的版本号
    // logger.debug('clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);

    // 1、若服务端版本号和客户端版本号不同，返回保存不成功，并返回未保存的操作？——什么情况下造成版本不同？
    if (serverVersion !== clientVersion) {
      const result = {
        success: false,
        error_type: 'version_behind_server',
        operations: operations
      };
      logger.warn('Version do not match: clientVersion: %s, serverVersion: %s', clientVersion, serverVersion);
      logger.warn('apply operations failed: sdoc uuid is %s, modified user is %s, execute operations %o', document.docUuid, user.username, operations);
      callback && callback(result);
      return;
    }

    // 2、如果服务器版本和客户端版本一致，执行操作
    // 这个用 slate 的工具函数执行操作 applyOperations() (Transforms.applyToDraft(editor, null, operation)) 

    let isExecuteSuccess = false;
    try {
      isExecuteSuccess = applyOperations(document, operations, user);
    } catch (e) {
      logger.error('apply operations failed.', document.docUuid, operations);
      isExecuteSuccess = false;
    }
    // 2.1 执行操作成功 
    // execute operations success
    if (isExecuteSuccess) {
      const result = {
        success: true,
        version: document.version,
      };
      // 获取操作管理器
      const operationsManager = OperationsManager.getInstance();
      // 把操作写入到操作管理器中
      operationsManager.addOperations(doc_uuid, operations, document.version, user);
      // 把执行成功的结果，返回客户端
      callback && callback(result);
      return;
    }

    // 2.2 执行操作不成功
    // execute operations failed
    const result = {
      success: false,
      error_type: 'operation_exec_error',
      operations: operations
    };
    // 同样把失败的结果返回到客户端
    callback && callback(result);
  };

  // 执行悬挂的操作 results 应该是 PendingOperations 悬挂的操作数组
  applyPendingOperations = (document, results) => {
    // 把每一条结果遍历
    for (let result of results) {
      // 获取操作数组字符串，然后转换成对象
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
