import logger from "../loggers";
import DocumentManager from '../managers/document-manager';

class DocumentController {

  async loadFileContent(req, res) {
    const { file_uuid: fileUuid } = req.payload;

    try {
      const documentManager = DocumentManager.getInstance();
      const fileContent = await documentManager.getFile(fileUuid);
      res.send(fileContent);
      return;
    } catch(err) {
      logger.error(err);
      logger.error(`Load ${fileUuid}  file content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
  
  async saveFileContent(req, res) {

    const { file_uuid: fileUuid } = req.payload;

    const { 
      file_path: filePath, 
      file_name: fileName, 
      file_content: fileContent 
    } = req.body;

    try {
      const documentManager = DocumentManager.getInstance();
      await documentManager.saveFile(fileUuid, filePath, fileName, fileContent);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      logger.error(`Save ${fileUuid} file content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
}

const documentController = new DocumentController();

export default documentController;
