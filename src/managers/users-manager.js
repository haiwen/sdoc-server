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
    if (this.users.has(docUuid)) {
      let docUsers = this.users.get(docUuid);
      docUsers.delete(socketId);
      if (docUsers.size === 0) {
        this.users.delete(docUuid);
      }
    }
  };

  getDocUsers = (docUuid) => {
    let users = [];
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      docUsers.forEach((user, socketId) => {
        users.push(user.username);
      });
      // delete dup users
      return [...new Set(users)];
    }
    return users;
  };

}

export default UsersManager;
