class Document {

  constructor(docId, content, token, repoID, filePath) {
    this.docId = docId;
    this.value = content;
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };

    // todo need delete
    this.token = token;
    this.repoID = repoID;
    this.filePath = filePath;
    const params = filePath.split('/');
    this.fileName = params[params.length - 1];
  }

  setValue = (value) => {
    let last_access = new Date().getTime();
    this.value = value;
    let need_save = true;
    this.setMeta({last_access, need_save});
  };

  setMeta = (meta) => {
    meta = Object.assign({}, this.meta, meta);
    this.meta = meta;
  };

  getMeta = () => {
    return this.meta;
  };

}

export default Document;
