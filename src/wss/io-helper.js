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

  sendMessageToRoom = (sid, room_id, options) => {
    this.io.to(room_id).emit('message', `${options.name} has update content`);
  };
  
  sendMessageToPrivate = (sid, options) => {
    this.io.to(sid).emit('message', `${options.name} has join room`);
  };

}

export default IOHelper;
