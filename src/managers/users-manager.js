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
// 相同的用户，可能 socketID 不同（在不同的浏览器中打开）数据结构如上

class UsersManager {

  // 存储当前实例和全部的用户
  constructor() {
    this.instance = null;
    this.users = new Map();
  }

  // 获取当前类的实例（如果没有实例，直接新建一个实例）
  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new UsersManager();
    return this.instance;
  };

  // 增加用户（docUUID, socketID, userInfo）
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

  // 获取某个文档某个节点的用户
  getUser = (docUuid, socketId) => {
    if (this.users.has(docUuid)) {
      const docUsers = this.users.get(docUuid);
      return docUsers.get(socketId);
    }
    return null;
  };
  
  // 删除某个文档的用户
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
    // 并返回删除后的用户数量
    return usersCount;
  };

  // 获取某个文档的全部用户
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

}

export default UsersManager;
