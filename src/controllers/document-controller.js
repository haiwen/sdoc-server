import logger from "../loggers";
import DocumentManager from '../managers/document-manager';

class DocumentController {

  async loadDocContent(req, res) {
    const { doc_uuid: docUuid } = req.params;
    const { 
      doc_path: docPath, 
      doc_name: docName, 
    } = req.query;

    try {
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName, docPath);
      res.send(docContent);
      return;
    } catch(err) {
      logger.error(err);
      logger.error(`Load ${docUuid} doc content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
  
  async saveDocContent(req, res) {

    const { doc_uuid: docUuid } = req.params;

    const { 
      doc_path: docPath, 
      doc_name: docName, 
      doc_content: docContent
    } = req.body;

    try {
      // Form api: need parse string content to object content
      const content = JSON.parse(docContent);
      const documentManager = DocumentManager.getInstance();
      await documentManager.saveDoc(docUuid, docPath, docName, content);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      logger.error(`Save ${docUuid} doc content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
}

const documentController = new DocumentController();

export default documentController;
