import IOHelper from "../wss/io-helper";
import UsersManager from "./users-manager";

class NotificationManager {

  constructor() {
    this.instance = null;
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new NotificationManager();
    return this.instance;
  };

  sendNotificationToRoom = (docUuid, msgType, notification) => {
    const usersManager = UsersManager.getInstance();
    const socketIds = usersManager.getSocketIds(docUuid);
    const ioHelper = IOHelper.getInstance();
    for (let socketId of socketIds) {
      ioHelper.sendNotificationToPrivate(socketId, {"msg_type": msgType, "notification": notification});
    }
  };

  sendNotificationToUser = (docUuid, username, msgType, notification) => {
    const usersManager = UsersManager.getInstance();
    const socketId = usersManager.getSocketId(docUuid, username);
    const ioHelper = IOHelper.getInstance();
    ioHelper.sendNotificationToPrivate(socketId, {"msg_type": msgType, "notification": notification});
  };

}

export default NotificationManager;
