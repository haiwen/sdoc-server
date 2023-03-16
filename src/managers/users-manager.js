class UsersManager {

  constructor() {
    this.instance = null;
    this.users = {};
  }

  static getUserManager = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new UsersManager();
    return this.instance;
  };

  saveUser = () => {

  };

  getUsers = () => {

  };

  updateOnlineUser = (isConnect = true) => {
    // eslint-disable-next-line
    console.log(isConnect);
  };

}

export default UsersManager;
