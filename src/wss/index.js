import DocumentManager from "../managers/document-manager";
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
      // todo???
      const { file_uuid: fileUuid, file_path: filePath, file_name: fileName } = params;
      const documentManager = DocumentManager.getInstance();
      const fileContent = await documentManager.getFile(fileUuid, filePath, fileName);
      // todo

      const sid = socket.id;
      socket.join(fileUuid);
      this.ioHelper.sendMessageToPrivate(sid, params);
      callback && callback({status: 1});
    });
    
    socket.on('leave-room', (params) => {
      const { uuid: roomId } = params;
      this.ioHelper.sendMessageToRoom(socket, roomId, params);
    });
    
    socket.on('update-document', (params, callback) => {
      const { file_uuid: roomId, operations } = params;
      const documentManager = DocumentManager.getInstance();
      documentManager.execOperationsBySocket(params, (result) => {
        if (result.success) {
          const { version } = result;
          this.ioHelper.sendMessageToRoom(socket, roomId, {operations, version});
        }
        callback && callback(result);
      });
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
