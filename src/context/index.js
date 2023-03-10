class Context {

  constructor() {
    this.instance = null;
    this.users = [];
    this.files = [];
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    return new Context();
  };

  saveFile = () => {

  };

  getFile = () => {

  };

  serializeFile = () => {

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

export default Context;
