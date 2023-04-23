import logger from "../loggers";
import DocumentManager from '../managers/document-manager';
import { isRequestTimeout } from "../utils";

class DocumentController {

  async loadDocContent(req, res) {
    const { doc_uuid: docUuid } = req.params;

    try {
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid);
      res.send(docContent);
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Load ${docUuid} doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }
  
  async saveDocContent(req, res) {

    const { doc_uuid: docUuid } = req.params;
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

    try {
      const documentManager = DocumentManager.getInstance();
      await documentManager.saveDoc(docUuid, content);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Save ${docUuid} doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }
}

const documentController = new DocumentController();

export default documentController;
