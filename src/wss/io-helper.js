// 
class IOHelper {

  // socket io 工具类
  constructor(io) {
    this.io = io;
    this.instance = null;
  }

  // 获取实例
  static getInstance = (io) => {
    // 如果有参数，创建新的工具类并返回
    if (io) {
      this.instance = new IOHelper(io);
      return this.instance;
    }
    // 如果没有实例，也没有参数，抛出错误
    if (!this.instance) {
      throw new Error('The program execution sequence is wrong, please check the program and correct it');
    }
    // 返回工具类示例
    return this.instance;
  };

  // 广播错误信息（服务器错误后广播）
  broadcastMessage = () => {
    this.io.emit('message', `server error`);
  };

  // 给某个房间发送信息（更新文档）
  sendMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('update-document', {...params});
  };
  
  // 给房间发送鼠标信息（鼠标位置）
  sendCursorMessageToRoom = (socket, roomId, params) => {
    socket.to(roomId).emit('update-cursor', {...params});
  };
  
  // 发送进入房间信息（某个房间，发送用户信息）
  sendJoinRoomMessage = (socket, roomId, userInfo) => {
    socket.to(roomId).emit('join-room', userInfo);
  };

  // 发送离开房间的信息
  sendLeaveRoomMessage = (socket, roomId, username) => {
    socket.to(roomId).emit('leave-room', username);
  };
  
  // 给某个人发送信息（某个客户端）
  sendMessageToPrivate = (sid, params) => {
    this.io.to(sid).emit('message', `${params.name} has join room`);
  };

}

export default IOHelper;
