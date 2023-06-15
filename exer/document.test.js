class Document {

  constructor(uuid, name, content) {
    this.uuid = uuid;
    this.name = name;
    this.version = content.version;
    this.children = content.children;
    this.last_modify_user = content.last_modify_user;
    this.medadata = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };
  }

  setValue = (value, version) => {
    this.children = value;
    this.version = version;
    this.setMeta({
      last_access: new Date().getTime(),
      need_save: true,
    });
  }

  setMetaData = (meta) => {
    this.meta = Object.assign({}, this.meta, meta);
  }

  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  }

  getMetadata = () => {
    return this.medadata;
  }
}
