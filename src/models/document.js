class Document {

  constructor(fileUuid, filePath, fileName, fileContent) {
    this.fileUuid = fileUuid;
    this.version = fileContent.version;
    this.children = fileContent.children;
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };

    // used for interval save file's content
    this.filePath = filePath;
    this.fileName = fileName;
  }

  setValue = (value, version) => {
    let last_access = new Date().getTime();
    this.children = value;
    this.version = version;
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
