import logger from "../../../loggers";
import { isRequestTimeout } from "../../../utils";
import ExcalidrawManager from "../managers/excalidraw-manager";

class ExdrawController {

  async loadSceneContent(req, res) {
    const { file_uuid: exdrawUuid, filename: exdrawName, username } = req.payload;
    try {
      const excalidrawManager = ExcalidrawManager.getInstance();
      const sceneContent = await excalidrawManager.getSceneDoc(exdrawUuid, exdrawName, username);
      // There is no username when seahub get the exdraw content
      if (!username) {
        res.status(200).send(sceneContent);
        return;
      }
      res.set('Cache-control', 'no-store');
      res.send(sceneContent);
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }

      if (err.error_type === 'get_doc_download_link_error') {
        logger.error(`Get doc download link error. request url is: ${err.from_url}`);
        return res.status(500).send({
          'error_type': 'get_doc_download_link_error',
          'error_msg': 'Internal Server Error'
        });
      }

      if (err.error_type === 'content_load_invalid') {
        logger.error(`Load ${exdrawName}(${exdrawUuid}) from ${err.from_url} error`);
        return res.status(500).send({
          'error_type': 'content_load_invalid',
          'error_msg': 'Internal Server Error'
        });
      }

      if (err.error_type === 'content_invalid') {
        logger.error(err.message);
        return res.status(500).send({
          'error_type': 'content_invalid',
          'error_msg': err.message
        });
      }
      logger.error(`Load ${exdrawName}(${exdrawUuid}) doc content error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

  async saveSceneContent(req, res) {
    const { file_uuid: exdrawUuid, filename: exdrawName, username } = req.payload;
    const { doc_content: sceneContent } = req.body;

    if (!sceneContent) {
      res.status(400).send({"error_msg": `Param 'doc_content' is required`});
      return;
    }

    let content = null;

    try {
      // Form api: need parse string content to object content
      content = JSON.parse(sceneContent);
    } catch(err) {
      res.status(400).send({"error_msg": `Param 'doc_content' is not in the correct format`});
      return;
    }

    const excalidrawManager = ExcalidrawManager.getInstance();
    const saveFlag = await excalidrawManager.saveSceneDocToMemory(exdrawUuid, exdrawName, content, username);

    if (saveFlag) { // saved success
      res.send({success: true});
      return;
    }

    res.status(500).send({'error_msg': 'Internal Server Error'});
    return;
  }
}

const exdrawController = new ExdrawController();

export default exdrawController;
