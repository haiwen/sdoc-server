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

    socket.on('join-room', (options) => {
      const sid = socket.id;
      const { uuid: roomId } = options;
      socket.join(roomId);
      this.ioHelper.sendMessageToPrivate(sid, options);
    });
    
    socket.on('leave-room', (options) => {
      const sid = socket.id;
      const { uuid: roomId } = options;
      this.ioHelper.sendMessageToRoom(sid, roomId, options);
    });
    
    socket.on('update-content', (options) => {
      const sid = socket.id;
      const { uuid: roomId } = options;
      this.ioHelper.sendMessageToRoom(sid, roomId, options);
    });
    
    socket.on('server-error', (options) => {
      this.ioHelper.broadcastMessage(options);
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
