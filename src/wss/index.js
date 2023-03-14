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

    socket.on('join-room', (params, callback) => {
      const sid = socket.id;
      const { doc_id: roomId } = params;
      socket.join(roomId);
      this.ioHelper.sendMessageToPrivate(sid, params);
      callback && callback({status: 1});
    });
    
    socket.on('leave-room', (params) => {
      const { uuid: roomId } = params;
      this.ioHelper.sendMessageToRoom(socket, roomId, params);
    });
    
    socket.on('update-document', (params, callback) => {
      const { doc_id: roomId } = params;
      this.ioHelper.sendMessageToRoom(socket, roomId, params);
      callback && callback();
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
