class Document {

  constructor(docId, filePath, fileName, content) {
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

    // used for interval save file's content
    this.filePath = filePath;
    this.fileName = fileName;
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
