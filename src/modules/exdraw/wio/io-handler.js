import IOHelper from "./io-helper";

const roomId = 'demo001';

class ExdrawIOHandler {

  constructor(io) {
    this.ioHelper = IOHelper.getInstance(io);
    this.instance = null;
  }

  static getInstance = (io) => {
    if (io) {
      this.instance = new ExdrawIOHandler(io);
      return this.instance;
    }
    if (!this.instance) {
      throw new Error('The program execution sequence is wrong, please check the program and correct it');
    }
    return this.instance;
  };

  onConnection(socket) {
    // todo permission check

    socket.on('join-room', async (userInfo) => {
      // join room
      socket.join(roomId);
      this.ioHelper.sendJoinRoomMessage(socket, roomId, userInfo);
    });

    socket.on('update-document', (msg) => {
      this.ioHelper.sendMessageToRoom(socket, roomId, { msg });
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

}

export default ExdrawIOHandler;
