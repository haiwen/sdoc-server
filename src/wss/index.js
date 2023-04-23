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
      const { docUuid } = socket;
      try {
        // get doc content and add doc into memory
        const documentManager = DocumentManager.getInstance();
        docContent = await documentManager.getDoc(docUuid);
      } catch(err) {
        logger.error(`SOCKET_MESSAGE: get doc ${docUuid} failed form socket`);
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
    
    socket.on('leave-room', () => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      
      // delete current user from memory
      usersManager.deleteUser(docUuid, socket.id);
    });
    
    socket.on('update-document', (params, callback) => {
      const { doc_uuid: docUuid, operations } = params;
      const documentManager = DocumentManager.getInstance();
      documentManager.execOperationsBySocket(params, (result) => {
        if (result.success) {
          const { version } = result;
          const operationsManager = OperationsManager.getInstance();
          operationsManager.addOperations(docUuid, {operations, version});
          this.ioHelper.sendMessageToRoom(socket, docUuid, {operations, version});
        }
        callback && callback(result);
      });
    });

    socket.on('sync-document', async (params, callback) => {
      const { doc_uuid: docUuid } = params;
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid);
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
    
    socket.on('disconnect', () => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      
      // delete current user from memory
      usersManager.deleteUser(docUuid, socket.id);
    });
    
  }

}

export default IOServer;
