import md5 from "md5";
import fs from 'fs';
import { v4 } from "uuid";
import seaServerAPI from "../api/sea-server-api";
import { deleteDir, generateDefaultFileContent } from "../utils";

class DocumentManager {

  constructor() {
    this.instance = null;
    this.users = [];
    this.documents = new Map();
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    return new DocumentManager();
  };

  getFile = async (token, repoID, filePath) => {
    // TODO
    const docId = md5(filePath);
    const document = this.documents.get(docId);
    if (document) return document;
    
    const result = await seaServerAPI.getFileContent(token, repoID, filePath);
    const fileContent = result.data ? result.data : generateDefaultFileContent();
    const doc = {
      id: docId,
      ...fileContent,
    };
    this.documents.set(docId, doc);
    return doc;
  };

  saveFile = async (token, repoID, filePath, fileName, fileContent) => {
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, fileContent, { flag: 'w+' });
    try {
      await seaServerAPI.saveFileContent(token, repoID, filePath, fileName, {path: tempPath});
      deleteDir(tempPath);
    } catch(err) {
      deleteDir(tempPath);
      throw new Error(err);
    }
  };

  serializeFile = () => {

  };

}

export default DocumentManager;
