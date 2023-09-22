import formatDocContentToNewVersion from './document-format';
import { normalizeChildren } from "./document-utils";

class Document {

  constructor(docUuid, docName, docContent) {
    this.docUuid = docUuid;
    this.docName = docName;

    // const newDocContent = docContent;
    const newDocContent = formatDocContentToNewVersion(docContent);
    this.version = newDocContent.version;
    this.format_version = newDocContent.format_version;
    this.children = normalizeChildren(newDocContent.children);
    this.last_modify_user = newDocContent.last_modify_user;
    this.cursors = {};  // default is empty object
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
    this.meta = {...this.meta, ...meta};
  };

  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  };

  getMeta = () => {
    return this.meta;
  };

  toJson = () => {
    return {
      version: this.version,
      format_version: this.format_version,
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
