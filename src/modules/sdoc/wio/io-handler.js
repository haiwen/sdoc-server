import logger from "../../../loggers";
import { socketTime, slowSocketTime } from '../../../loggers';
import { getErrorMessage } from "../../../utils";
import seaServerAPI from "../api/sea-server-api";
import { OPERATIONS_CACHE_LIMIT } from "../constants";
import DocumentManager from "../managers/document-manager";
import OperationsManager from "../managers/operations-manager";
import UsersManager from "../managers/users-manager";
import IOHelper from "./io-helper";
import isPermissionValid from "./is-permission-valid";

const recordSocketLogger = (docUuid, operations, costsTime) => {

  const operationType = operations[0].type;
  const operateCount = operations.length;
  socketTime.info(docUuid, operationType, operateCount, `${costsTime}ms`);
  if (costsTime > 200) {
    slowSocketTime.info(docUuid, operationType, operateCount, `${costsTime}ms`);
  }

};

class IOHandler {

  constructor(io) {
    this.ioHelper = IOHelper.getInstance(io);
    this.instance = null;
  }

  static getInstance = (io) => {
    if (io) {
      this.instance = new IOHandler(io);
      return this.instance;
    }
    if (!this.instance) {
      throw new Error('The program execution sequence is wrong, please check the program and correct it');
    }
    return this.instance;
  };

  onConnection(socket) {
    // todo permission check

    socket.on('join-room', async (callback) => {
      let docContent = null;
      const { docUuid, docName } = socket;
      try {
        // get doc content and add doc into memory
        const documentManager = DocumentManager.getInstance();
        docContent = await documentManager.getDoc(docUuid, docName);
      } catch(err) {
        logger.error(`SOCKET_MESSAGE: Load ${docName}(${docUuid}) doc content error`);
        callback && callback({success: 0});
        return;
      }

      // join room
      socket.join(docUuid);

      // add current user into memory
      const { userInfo } = socket;
      const usersManager = UsersManager.getInstance();
      usersManager.addUser(docUuid, socket.id, userInfo);
      this.ioHelper.sendJoinRoomMessage(socket, docUuid, userInfo);

      // const sid = socket.id;
      // this.ioHelper.sendMessageToPrivate(sid, params);

      const { version } = docContent;
      callback && callback({success: 1, version});
    });

    socket.on('update-document', async (params, callback) => {
      const start = Date.now();
      const isValid = isPermissionValid(socket);
      if (!isValid) {
        const result = {
          success: false,
          error_type: 'token_expired',
        };
        callback && callback(result);
        return;
      }
      const { docName } = socket;
      const { doc_uuid: docUuid, operations, user, selection, cursor_data } = params;
      const documentManager = DocumentManager.getInstance();
      const result = await documentManager.execOperationsBySocket(params, docName);
      
      const end = Date.now();
      const costsTime = end - start;
      try {
        recordSocketLogger(docUuid, operations, costsTime);
      } catch (e) {
        logger.warn(`recordSocketLogger error: ${e}`);
      }

      if (result.success) {
        const { version } = result;
        this.ioHelper.sendMessageToRoom(socket, docUuid, { operations, version, user, selection, cursor_data});
      }
      callback && callback(result);
    });

    socket.on('update-cursor', (params) => {
      // update cursor
      const documentManager = DocumentManager.getInstance();
      documentManager.setCursorLocation(params);

      // send message to others
      const { doc_uuid: docUuid, user, location, cursor_data } = params;
      this.ioHelper.sendCursorMessageToRoom(socket, docUuid, {user, location, cursor_data});
    });

    socket.on('sync-document', async (params, callback) => {
      const { docName } = socket;
      const { doc_uuid: docUuid } = params;
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName);
      const { version: serverVersion } = docContent;
      const { version: clientVersion } = params;
      // return document
      if (serverVersion - clientVersion > OPERATIONS_CACHE_LIMIT) {
        const result = {
          success: true,
          mode: 'document',
          content: docContent
        };
        callback && callback(result);
        return;
      }

      // return operations
      const operationsManager = OperationsManager.getInstance();
      const operationList = await operationsManager.getLoseOperationList(docUuid, clientVersion);
      const result = {
        success: true,
        mode: 'operations',
        content: operationList,
      };
      callback && callback(result);
      return;
    });

    socket.on('user-updated', (params) => {

      const { user } = params;
      const { docUuid } = socket;

      // update storage user name
      const usersManager = UsersManager.getInstance();
      usersManager.deleteUser(docUuid, socket.id);
      usersManager.addUser(docUuid, socket.id, user);

      this.ioHelper.sendUserUpdatedMessage(socket, docUuid, user);
    });

    socket.on('reload-image', () => {
      const { docUuid } = socket;
      this.ioHelper.sendReloadImageMessage(socket, docUuid);
    });

    socket.on('server-error', (params) => {
      this.ioHelper.broadcastMessage(params);
    });

    socket.on('leave-room', async () => {
      await this.handleDisconnect(socket);
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

  handleDisconnect = async (socket) => {
    const { docUuid, docName } = socket;
    const usersManager = UsersManager.getInstance();
    const user = usersManager.getUser(docUuid, socket.id);
    if (user) {
      this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
    }

    // delete current user from memory
    const usersCount = usersManager.deleteUser(docUuid, socket.id);
    const documentManager = DocumentManager.getInstance();
    user && documentManager.deleteCursor(docUuid, user);
    if (usersCount === 0) {
      // save document first
      await documentManager.saveDoc(docUuid);

      // send no_write message to seahub
      const status = 'no_write';
      seaServerAPI.editorStatusCallback(docUuid, status)
        .then(() => {
          logger.info(`${docName}(${docUuid}) unlocked success`);
        }).catch(err => {
          const message = getErrorMessage(err);
          if (message.status && message.status === 404) {
            logger.info(`${docName}(${docUuid}) unlocked failed`);
            logger.info(JSON.stringify(message));
          } else {
            logger.error(`${docName}(${docUuid}) unlocked failed`);
            logger.error(JSON.stringify(message));
          }
        });
    }
  };
}

export default IOHandler;
