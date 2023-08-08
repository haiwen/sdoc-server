import { OPERATIONS_CACHE_LIMIT } from "../constants";
import logger from "../loggers";
import DocumentManager from "../managers/document-manager";
import OperationsManager from "../managers/operations-manager";
import UsersManager from "../managers/users-manager";
import auth from "./auth";
import IOHelper from "./io-helper";

class IOServer {

  constructor(io) {
    this.connectCount = 0;
    this.io = io;
    this.ioHelper = IOHelper.getInstance(io);
    io.on('connection', (socket) => { this.onConnected(socket); });
    io.use(auth);
  }

  onConnected(socket) {
    
    this.connectCount++;

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
    
    socket.on('leave-room', async () => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      }
      
      // delete current user from memory
      const usersCount = usersManager.deleteUser(docUuid, socket.id);
      const documentManager = DocumentManager.getInstance();
      documentManager.deleteCursor(docUuid, user);
      if (usersCount === 0) {
        const savedBySocket = true;
        await documentManager.saveDoc(docUuid, savedBySocket);
      }
    });
    
    socket.on('update-document', (params, callback) => {
      const { doc_uuid: docUuid, operations, user, selection, cursor_data } = params;
      const documentManager = DocumentManager.getInstance();
      documentManager.execOperationsBySocket(params, (result) => {
        if (result.success) {
          const { version } = result;
          this.ioHelper.sendMessageToRoom(socket, docUuid, {operations, version, user, selection, cursor_data});
        }
        callback && callback(result);
      });
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
      const operationList = operationsManager.getLoseOperationList(docUuid, clientVersion);
      const result = {
        success: true,
        mode: 'operations',
        content: operationList,
      };
      callback && callback(result);
      return;
    });
    
    socket.on('server-error', (params) => {
      this.ioHelper.broadcastMessage(params);
    });
    
    socket.on('disconnect', async () => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      }
      
      // delete current user from memory
      const usersCount = usersManager.deleteUser(docUuid, socket.id);
      const documentManager = DocumentManager.getInstance();
      documentManager.deleteCursor(docUuid, user);
      if (usersCount === 0) {
        const savedBySocket = true;
        await documentManager.saveDoc(docUuid, savedBySocket);
      }
    });
    
  }

}

export default IOServer;
