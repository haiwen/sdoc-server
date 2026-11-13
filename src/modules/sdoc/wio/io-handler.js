import logger from "../../../loggers";
import { socketTime, slowSocketTime } from '../../../loggers';
import { getErrorMessage } from "../../../utils";
import seaServerAPI from "../api/sea-server-api";
import { OPERATIONS_CACHE_LIMIT } from "../constants";
import DocumentManager from "../managers/document-manager";
import OperationsManager from "../managers/operations-manager";
import UsersManager from "../managers/users-manager";
import IOHelper from "./io-helper";

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
    socket.on('join-room', async (params, callback = () => {}) => {
      try {
        let docContent = null;
        const { docUuid, docName } = socket;
        try {
          // get doc content and add doc into memory
          const documentManager = DocumentManager.getInstance();
          docContent = await documentManager.getDoc(docUuid, docName);
        } catch(err) {
          logger.error(`SOCKET_MESSAGE: Load ${docName}(${docUuid}) doc content error`);
          callback({ success: 0 });
          return;
        }

        // join room
        if (socket.disconnected) return;
        socket.join(docUuid);

        // add current user into memory
        const { userInfo } = socket;
        const usersManager = UsersManager.getInstance();
        usersManager.addUser(docUuid, socket.id, userInfo);
        this.ioHelper.sendJoinRoomMessage(socket, docUuid, userInfo);

        const { version } = docContent;
        callback({success: 1, version});
      } catch (err) {
        logger.error(`Socket event join-room failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('update-document', async (params, callback = () => {}) => {
      try {
        const start = Date.now();
        const { docUuid, docName } = socket;
        const { operations, selection, cursor_data } = params;
        const user = { ...socket.userInfo };
        const documentManager = DocumentManager.getInstance();
        const result = await documentManager.execOperationsBySocket({ ...params, doc_uuid: docUuid, user }, docName);

        const end = Date.now();
        const costsTime = end - start;
        try {
          recordSocketLogger(docUuid, operations, costsTime);
        } catch (e) {
          logger.warn(`recordSocketLogger error: ${e}`);
        }

        if (result.success) {
          const { version } = result;
          // The edit is already applied; online collaborators still need it after the sender disconnects.
          this.ioHelper.sendMessageToRoom(socket, docUuid, { operations, version, user, selection, cursor_data});
        }
        if (socket.disconnected) return;
        callback(result);
      } catch (err) {
        logger.error(`Socket event update-document failed: ${err.message}`);
        if (!socket.disconnected) callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('update-cursor', (params, callback = () => {}) => {
      try {
        // update cursor
        const { docUuid } = socket;
        const { location, cursor_data } = params;
        const user = { ...socket.userInfo };
        const documentManager = DocumentManager.getInstance();
        documentManager.setCursorLocation({ ...params, doc_uuid: docUuid, user });

        // send message to others
        this.ioHelper.sendCursorMessageToRoom(socket, docUuid, {user, location, cursor_data});
      } catch (err) {
        logger.error(`Socket event update-cursor failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('sync-document', async (params, callback = () => {}) => {
      try {
        const { docUuid, docName } = socket;
        const documentManager = DocumentManager.getInstance();
        const docContent = await documentManager.getDoc(docUuid, docName);
        if (socket.disconnected) return;
        const { version: serverVersion } = docContent;
        const { version: clientVersion } = params;
        // return document
        if (serverVersion - clientVersion > OPERATIONS_CACHE_LIMIT) {
          const result = {
            success: true,
            mode: 'document',
            content: docContent
          };
          callback(result);
          return;
        }

        // return operations
        const operationsManager = OperationsManager.getInstance();
        const operationList = await operationsManager.getLoseOperationList(docUuid, clientVersion);
        if (socket.disconnected) return;
        const result = {
          success: true,
          mode: 'operations',
          content: operationList,
        };
        callback(result);
        return;
      } catch (err) {
        logger.error(`Socket event sync-document failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('user-updated', (params, callback = () => {}) => {
      try {
        const { docUuid } = socket;
        // A display name may change; the authenticated identity and permission may not.
        const user = {
          ...socket.userInfo,
          ...(typeof params.user?.name === 'string' ? { name: params.user.name } : {}),
        };
        socket.userInfo = user;

        // update storage user name
        const usersManager = UsersManager.getInstance();
        usersManager.deleteUser(docUuid, socket.id);
        usersManager.addUser(docUuid, socket.id, user);

        this.ioHelper.sendUserUpdatedMessage(socket, docUuid, user);
      } catch (err) {
        logger.error(`Socket event user-updated failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('reload-image', (params, callback = () => {}) => {
      try {
        const { docUuid } = socket;
        this.ioHelper.sendReloadImageMessage(socket, docUuid);
      } catch (err) {
        logger.error(`Socket event reload-image failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('server-error', (params, callback = () => {}) => {
      try {
        this.ioHelper.broadcastMessage(socket.docUuid);
      } catch (err) {
        logger.error(`Socket event server-error failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('leave-room', async (params, callback = () => {}) => {
      try {
        await this.handleDisconnect(socket);
      } catch (err) {
        logger.error(`Socket event leave-room failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

  handleDisconnect = async (socket) => {
    const { docUuid, docName } = socket;
    const usersManager = UsersManager.getInstance();
    const user = usersManager.getUser(docUuid, socket.id);
    const usersCount = user ? usersManager.deleteUser(docUuid, socket.id) : 0;
    await socket.leave(docUuid);
    if (!user) return;
    if (user) {
      this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
    }

    // delete current user from memory
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
