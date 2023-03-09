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
  }

  saveFile = () => {

  }

  getFile = () => {

  }

  serializeFile = () => {

  }

  saveUser = () => {

  }

  getUsers = () => {

  }

  updateOnlineUser = (isConnect = true) => {

  }

}

export default Context;
