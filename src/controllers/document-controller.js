import logger from "../loggers";
import DocumentManager from '../managers/document-manager';
import { resetDocContentCursors } from "../models/document-utils";
import { isRequestTimeout } from "../utils";
import IOHelper from "../wss/io-helper";
import { MESSAGE } from '../constants';

class DocumentController {

  async loadDocContent(req, res) {
    const { file_uuid: docUuid, filename: docName, username } = req.payload;
    try {
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName);
      const newDocContent = resetDocContentCursors(docContent, username);
      res.set('Cache-control', 'no-store');
      res.send(newDocContent);
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      if (err.error_type === 'content_invalid') {
        logger.error(err.message);
        return res.status(500).send({
          'error_type': 'content_invalid',
          'error_msg': err.message
        });
      }
      logger.error(`Load ${docName}(${docUuid}) doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }
  
  async saveDocContent(req, res) {

    const { file_uuid: docUuid, filename: docName } = req.payload;
    const { doc_content: docContent } = req.body;

    if (!docContent) {
      res.status(400).send({"error_msg": `Param 'doc_content' is required`});
      return;
    }
    
    let content = null;
    
    try {
      // Form api: need parse string content to object content
      content = JSON.parse(docContent);
    } catch(err) {
      res.status(400).send({"error_msg": `Param 'doc_content' is not in the correct format`});
      return;
    }

    const documentManager = DocumentManager.getInstance();
    const saveFlag = await documentManager.saveDoc(docUuid, docName, content);
    if (saveFlag) { // saved success
      res.send({success: true});
      return;
    }

    res.status(500).send({'error_msg': 'Internal Server Error'});
    return;
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

  async removeContent(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const ioHelper = IOHelper.getInstance();
    try {
      const documentManager = DocumentManager.getInstance();
      documentManager.removeDoc(docUuid);
      ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_REMOVED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Remove ${docUuid} doc in memory error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async saveDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { username } = req.payload;
    const documentManager = DocumentManager.getInstance();
    const saveFlag = await documentManager.saveDoc(docUuid, username, true);
    if (saveFlag) {
      res.status(200).send({'success': true});
      return;
    }
    res.status(500).send({'error_msg': 'Doc save failed'});
    return;
  }

  async publishDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { origin_doc_uuid: originDocUuid, origin_doc_name: originDocName } = req.body;
    const documentManager = DocumentManager.getInstance();

    // send message to all: doc has been publish
    const ioHelper = IOHelper.getInstance();
    ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_PUBLISHED);

    const removeFlag = await documentManager.removeDocFromMemory(docUuid);
    if (!removeFlag) {
      logger.error(`Doc ${docUuid} remove from memory failed`);
    }

    if (!documentManager.isDocInMemory(originDocUuid)) {
      res.status(200).send({'success': true});
      return;
    }

    try {

      // get doc content and add doc into memory
      const originDocument = await documentManager.reloadDoc(originDocUuid, originDocName);
      originDocument && ioHelper.sendMessageToAllInRoom(originDocUuid, MESSAGE.DOC_REPLACED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }

  }

  async reloadDoc(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { doc_name: docName } = req.body;
    const documentManager = DocumentManager.getInstance();
    const ioHelper = IOHelper.getInstance();

    if (!documentManager.isDocInMemory(docUuid)) {
      res.status(200).send({'success': true});
      return;
    }

    try {

      // get doc content and add doc into memory
      await documentManager.reloadDoc(docUuid, docName);
      ioHelper.sendMessageToAllInRoom(docUuid, MESSAGE.DOC_REPLACED);
      res.status(200).send({'success': true});
      return;
    } catch(err) {
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

}

const documentController = new DocumentController();

export default documentController;
