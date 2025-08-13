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

  sendElementsMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('elements-updated', {...params});
  };

  sendMouseMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('mouse-location-updated', {...params});
  };

  sendJoinRoomMessage = (socket, roomId, userInfo) => {
    socket.to(roomId).emit('join-room', userInfo);
  };

  sendRoomUserChangeMessage = (socket, roomId, users) => {
    this.io.of(EXDRAW_NAMESPACE).to(roomId).emit('room-user-change', users);
  };

  sendLeaveRoomMessage = (socket, roomId, username) => {
    socket.to(roomId).emit('leave-room', username);
  };

  sendInitRoomToPrivate = (sid) => {
    this.io.of(EXDRAW_NAMESPACE).to(sid).emit('init-room');
  };

  sendFirstInRoomMessage = (sid) => {
    this.io.of(EXDRAW_NAMESPACE).to(sid).emit('first-in-room');
  };

  sendNewUserMessage = (socket, roomId) => {
    socket.to(roomId).emit('new-user');
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
