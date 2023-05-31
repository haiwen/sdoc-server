import { normalizeChildren } from "./document-utils";
// 文档对象

class Document {

  // 文档对象的属性
  constructor(docUuid, docName, docContent) {
    this.docUuid = docUuid;
    this.docName = docName;
    this.version = docContent.version;
    this.children = normalizeChildren(docContent.children);
    this.cursors = {};  // default is empty object
    this.last_modify_user = docContent.last_modify_user;
    // 元数据
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };
  }

  // 设置值，并更新版本
  // 同时设置需要保存，设置 last_access 是当前时间（最后操作的时间）
  setValue = (value, version) => {
    let last_access = new Date().getTime();
    this.children = value;
    this.version = version;
    let need_save = true;
    this.setMeta({last_access, need_save});
  };

  // 更改元数据（直接对象替换）
  setMeta = (meta) => {
    this.meta = {...this.meta, ...meta};
  };

  // 设置最后更改人
  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  };

  // 获取元数据
  getMeta = () => {
    return this.meta;
  };

  toJson = () => {
    return {
      version: this.version,
      children: this.children,
      cursors: this.cursors,
      last_modify_user: this.last_modify_user,
    };
  };

  setCursor = (user, location, cursorData) => {
    // selection: { anchor, focus }
    // cursor: { anchor, focus }

    if (!this.cursors) this.cursors = {};
    const { username: clientId } = user;
  
    if (location) {
      const oldCursor = this.cursors[clientId] ? this.cursors[clientId] : {};
      const newCursorData = { ...oldCursor, ...location, ...cursorData};
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
