import IOHelper from "../wio/io-helper";
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

  sendNotificationToRoom = (docUuid, notification) => {
    const usersManager = UsersManager.getInstance();
    const socketIds = usersManager.getSocketIds(docUuid);
    const ioHelper = IOHelper.getInstance();
    if (socketIds.length > 0) {
      for (let socketId of socketIds) {
        ioHelper.sendNotificationToPrivate(socketId, notification);
      }
    }
  };

  sendNotificationToUser = (docUuid, username, notification) => {
    const usersManager = UsersManager.getInstance();
    const socketId = usersManager.getSocketId(docUuid, username);
    const ioHelper = IOHelper.getInstance();
    if (socketId) {
      ioHelper.sendNotificationToPrivate(socketId, notification);
    }
  };

}

export default NotificationManager;
