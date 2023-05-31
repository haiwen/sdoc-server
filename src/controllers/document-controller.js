import logger from "../loggers";
import DocumentManager from '../managers/document-manager';
import { isRequestTimeout } from "../utils";

class DocumentController {

  // 加载文档内容
  async loadDocContent(req, res) {
    // 从请求体中获取 UUID 和 name
    const { file_uuid: docUuid, filename: docName } = req.payload;
    try {
      // 获取文件管理对象实例，然后异步获取文件内容
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName);
      res.set('Cache-control', 'no-store');
      res.send(docContent);
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Load ${docName}(${docUuid}) doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }
  
  // 保存文档内容
  async saveDocContent(req, res) {

    const { file_uuid: docUuid, filename: docName } = req.payload;
    const { doc_content: docContent } = req.body;

    if (!docContent) {
      res.status(400).send({"error_msg": `Param 'doc_content' is required`});
      return;
    }
    
    let content = null;
    
    // 先把 docContent 字符串转换成对象
    try {
      // Form api: need parse string content to object content
      content = JSON.parse(docContent);
    } catch(err) {
      res.status(400).send({"error_msg": `Param 'doc_content' is not in the correct format`});
      return;
    }

    // 获取实例，并异步保存文档
    const documentManager = DocumentManager.getInstance();
    const saveFlag = await documentManager.saveDoc(docUuid, docName, content);
    if (saveFlag) { // saved success
      res.send({success: true});
      return;
    }

    res.status(500).send({'error_msg': 'Internal Server Error'});
    return;
  }

  async internalRefreshDocs(req, res) {
    // used for sdoc publish revision
    const { doc_uuids: docUuids } = req.body;
    try {
      const documentManager = DocumentManager.getInstance();
      documentManager.removeDocs(docUuids);
      res.send({"success": true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Remove ${docUuids.join(' ')} doc in memory error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async normalizeSdoc(req, res) {
    const { file_uuid: docUuid } = req.payload;
    try {
      const documentManager = DocumentManager.getInstance();
      documentManager.normalizeSdoc(docUuid);
      res.send({"success": true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Normalize doc ${docUuid} failed`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

}

const documentController = new DocumentController();

export default documentController;
