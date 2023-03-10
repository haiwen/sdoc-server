import seaServerAPI from "../api/sea-server-api";
import logger from "../loggers";
import { deleteDir } from "../utils";



class FileContentController {

  async loadFileContent(req, res) {
    const { token, repo_id: repoID, file_path: filePath } = req.query;
    try {
      const result = await seaServerAPI.getFileContent(token, repoID, filePath);
      const fileContent = result.data ? result.data : generateDefaultFileContent();
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
    
    const tempPath = `/tmp/` + v4();
    fs.writeFileSync(tempPath, fileContent, { flag: 'w+' });

    try {
      await seaServerAPI.saveFileContent(token, repoID, filePath, fileName, fileContent);
      deleteDir(tempPath);
      res.send({success: true});
      return;
    } catch(err) {
      deleteDir(tempPath);
      logger.error(err);
      logger.error(`Save ${repoID} file content error`);
      res.status(500).send({'error_msg': 'internal server error'});
      return;
    }
  }
}

const fileContentController = new FileContentController();

export default fileContentController;
