import { EXDRAW_NAMESPACE } from "../constants";

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

  getConnectedSocketsCount = () => {
    return this.io.of(EXDRAW_NAMESPACE).sockets.sockets.size;
  };

  broadcastMessage = () => {
    this.io.of(EXDRAW_NAMESPACE).emit('message', `server error`);
  };

  sendMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('update-document', {...params});
  };

  sendCursorMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('update-cursor', {...params});
  };

  sendJoinRoomMessage = (socket, roomId, userInfo) => {
    socket.to(roomId).emit('join-room', userInfo);
  };

  sendLeaveRoomMessage = (socket, roomId, username) => {
    socket.to(roomId).emit('leave-room', username);
  };

  sendMessageToPrivate = (sid, params) => {
    this.io.of(EXDRAW_NAMESPACE).to(sid).emit('message', `${params.name} has join room`);
  };

  sendMessageToAllInRoom = (roomId, message) => {
    this.io.of(EXDRAW_NAMESPACE).to(roomId).emit(message);
  };

  sendNotificationToPrivate = (sid, notification) => {
    this.io.of(EXDRAW_NAMESPACE).to(sid).emit('new-notification', notification);
  };

  sendParticipantsChanges = (sid, key, value) => {
    this.io.of(EXDRAW_NAMESPACE).to(sid).emit(key, value);
  };

}

export default IOHelper;
