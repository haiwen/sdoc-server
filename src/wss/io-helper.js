class IOHelper {

  constructor(io) {
    this.io = io;
    this.instance = null;
  }

  static getInstance = (io) => {
    if (io) {
      this.instance = new IOHelper(io);
      return this.instance;
    }
    if (!this.instance) {
      throw new Error('The program execution sequence is wrong, please check the program and correct it');
    }
    return this.instance;
  };

  broadcastMessage = () => {
    this.io.emit('message', `server error`);
  };

  sendMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('update-document', {...params});
  };
  
  sendJoinRoomMessage = (socket, roomId, username) => {
    socket.to(roomId).emit('join-room', username);
  };

  sendLeaveRoomMessage = (socket, roomId, username) => {
    socket.to(roomId).emit('leave-room', username);
  };
  
  sendMessageToPrivate = (sid, params) => {
    this.io.to(sid).emit('message', `${params.name} has join room`);
  };

}

export default IOHelper;
