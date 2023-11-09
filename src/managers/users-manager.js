/**
 * socketId is different, bur user info may be same with another(same user open several browsers)
 * users = {
 *  docUuid: {
 *    socketId: userInfo
 *    socketId: userInfo
 *    socketId: userInfo
 *    socketId: userInfo
 *    socketId: userInfo
 *  }
 * }
 */
class UsersManager {

  constructor() {
    this.instance = null;
    this.users = new Map();
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new UsersManager();
    return this.instance;
  };

  addUser = (docUuid, socketId, userInfo) => {
    if (!this.users.has(docUuid)) {
      this.users.set(docUuid, new Map());
    }
    const docUsers = this.users.get(docUuid);
    // current user is exist
    if (docUsers.has(socketId)) return;

    docUsers.set(socketId, userInfo);
    this.users.set(docUuid, docUsers);
  };

  getUser = (docUuid, socketId) => {
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      return docUsers.get(socketId);
    }
    return null;
  };
  
  deleteUser = (docUuid, socketId) => {
    let usersCount = 0;
    if (this.users.has(docUuid)) {
      let docUsers = this.users.get(docUuid);
      docUsers.delete(socketId);
      usersCount = docUsers.size;
      if (usersCount === 0) {
        this.users.delete(docUuid);
      }
    }
    return usersCount;
  };

  getDocUsers = (docUuid) => {
    let users = {};
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      docUsers.forEach((user, socketId) => {
        users[user.username] = user;
      });
    }
    return Object.values(users);
  };

  getSocketIds = (docUuid) => {
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      return docUsers.keys();
    }
    return [];
  };

  getSocketId = (docUuid, username) => {
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      for (let [socketId, userInfo] of docUsers) {
        if (userInfo.username === username) {
          return socketId;
        }
      }
    }
    return null;
  };

}

export default UsersManager;
