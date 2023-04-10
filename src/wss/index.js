import { OPERATIONS_CACHE_LIMIT } from "../constants";
import DocumentManager from "../managers/document-manager";
import OperationsManager from "../managers/operations-manager";
import IOHelper from "./io-helper";

class IOServer {

  constructor(io) {
    this.connectCount = 0;
    this.io = io;
    this.ioHelper = IOHelper.getInstance(io);
    io.on('connection', (socket) => { this.onConnected(socket); });
  }

  onConnected(socket) {
    
    this.connectCount++;

    // todo permission check

    socket.on('join-room', async (params, callback) => {
      
      // get file content and add file into memory
      const { file_uuid: fileUuid, file_path: filePath, file_name: fileName } = params;
      const documentManager = DocumentManager.getInstance();
      const fileContent = await documentManager.getFile(fileUuid, filePath, fileName);
      
      // join room
      socket.join(fileUuid);

      // const sid = socket.id;
      // this.ioHelper.sendMessageToPrivate(sid, params);

      const { version } = fileContent;
      callback && callback({success: 1, version});
    });
    
    socket.on('leave-room', (params) => {
      const { uuid: roomId } = params;
      this.ioHelper.sendMessageToRoom(socket, roomId, params);
    });
    
    socket.on('update-document', (params, callback) => {
      const { file_uuid: fileUuid, operations } = params;
      const documentManager = DocumentManager.getInstance();
      documentManager.execOperationsBySocket(params, (result) => {
        if (result.success) {
          const { version } = result;
          const operationsManager = OperationsManager.getInstance();
          operationsManager.addOperations(fileUuid, {operations, version});
          this.ioHelper.sendMessageToRoom(socket, fileUuid, {operations, version});
        }
        callback && callback(result);
      });
    });

    socket.on('sync-document', async (params, callback) => {
      const { file_uuid: fileUuid, file_path: filePath, file_name: fileName } = params;
      const documentManager = DocumentManager.getInstance();
      const fileContent = await documentManager.getFile(fileUuid, filePath, fileName);
      const { version: serverVersion } = fileContent;
      const { version: clientVersion } = params;
      // return document
      if (serverVersion - clientVersion > OPERATIONS_CACHE_LIMIT) {
        const result = {
          success: true,
          mode: 'document',
          content: fileContent
        };
        callback && callback(result);
        return;
      }

      // return operations
      const operationsManager = OperationsManager.getInstance();
      const operationList = operationsManager.getLoseOperationList(fileUuid, clientVersion);
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
      const sid = socket.id;
      this.ioHelper.sendMessageToPrivate(sid, 'disconnect success');
    });
    
    socket.on('reconnect', () => {
      const sid = socket.id;
      this.ioHelper.sendMessageToPrivate(sid, 'reconnect success');
    });
  }

}

export default IOServer;
