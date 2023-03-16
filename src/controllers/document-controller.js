import logger from "../loggers";
import DocumentManager from '../managers/document-manager';

class DocumentController {

  async loadFileContent(req, res) {
    const { token, repo_id: repoID, file_path: filePath } = req.query;
    try {
      const documentManager = DocumentManager.getInstance();
      const fileContent = await documentManager.getFile(token, repoID, filePath);
      res.send(fileContent);
      return;
    } catch(err) {
      logger.error(err);
      logger.error(`Load ${repoID}  file content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
  
  async saveFileContent(req, res) {

    const { 
      token, 
      repo_id: repoID, 
      file_path: filePath, 
      file_name: fileName, 
      file_content: fileContent 
    } = req.body;

    try {
      const documentManager = DocumentManager.getInstance();
      await documentManager.saveFile(token, repoID, filePath, fileName, fileContent);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err);
      logger.error(`Save ${repoID} file content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
}

const documentController = new DocumentController();

export default documentController;
