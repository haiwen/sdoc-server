class ExcalidrawDocument {

  constructor(exdrawUuid, exdrawName, exdrawContent) {
    this.exdrawUuid = exdrawUuid;
    this.exdrawName = exdrawName;
    this.elements = exdrawContent.elements;
    this.version = exdrawContent.version;
    this.last_modify_user = exdrawContent.last_modify_user;
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };
  }

  setValue = (elements, version) => {
    let last_access = new Date().getTime();
    this.elements = elements;
    this.version = version;
    let need_save = true;
    this.setMeta({last_access, need_save});
  };

  setMeta = (meta) => {
    this.meta = {...this.meta, ...meta};
  };

  getMeta = () => {
    return this.meta;
  };

  toJson = () => {
    this.setMeta({last_access: new Date().getTime()});
    return {
      elements: this.elements,
      version: this.version,
      last_modify_user: this.last_modify_user
    };
  };

  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  };
}

export default ExcalidrawDocument;
