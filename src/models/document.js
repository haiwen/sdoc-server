import { Range } from "@seafile/slate";
class Document {

  constructor(docUuid, docName, docContent) {
    this.docUuid = docUuid;
    this.docName = docName;
    this.version = docContent.version;
    this.children = docContent.children;
    this.cursors = {};  // default is empty object
    this.last_modify_user = docContent.last_modify_user;
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };
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

  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  };

  getMeta = () => {
    return this.meta;
  };

  setCursor = (operations, user, selection, cursorData) => {
    // selection: { anchor, focus }
    // cursor: { anchor, focus }

    const { username: clientId } = user;
    const cursorOps = operations.filter(operation => operation.type === 'set_selection');
  
    if (!this.cursors) this.cursors = {};
  
    const oldCursor = this.cursors[clientId] ? this.cursors[clientId] : {};
    const lastCursorOp = cursorOps[cursorOps.length - 1];
  
    if (selection) {
      const newCursor = (lastCursorOp && lastCursorOp.newProperties) || {};
  
      const newCursorData = { ...oldCursor, ...newCursor, ...selection, ...{
        ...cursorData,
        isForward: Range.isForward(selection)
      }};
      this.cursors[clientId] = newCursorData;
    } else {
      delete this.cursors[clientId];
    }
  };

  deleteCursor = (userInfo) => {
    const { username } = userInfo;
    delete this.cursors[username];
  };

}

export default Document;
