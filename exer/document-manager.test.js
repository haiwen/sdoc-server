// todo
class DocumentManager {

  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();
    this.isSaving = false;
    this.lastSavingInfo = {};
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DocumentManager();
    return this.instance;
  }
}
