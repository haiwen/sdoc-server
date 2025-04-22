import logger from "../../../loggers";
import { isRequestTimeout } from "../../../utils";
import DocumentManager from '../managers/document-manager';
import OperationsManager from '../managers/operations-manager';
import IOHelper from '../wio/io-helper';

class SystemController {

  async getInfo(req, res) {
    const { admin } = req.payload;
    if (!admin) {
      res.status(403).send({'error_msg': 'You don\'t have permission to access.'});
      return;
    }

    try {
      const version = process.env.server_version || 'dev';
      const documentManager = DocumentManager.getInstance();
      const operationsManager = OperationsManager.getInstance();
      const ioHelper = IOHelper.getInstance();

      let info = { version: version };
      info['web_socket_count'] = ioHelper.getConnectedSocketsCount();
      info['operation_count_since_up'] = operationsManager.operationCountSinceUp;
      info['last_period_operations_count'] = await operationsManager.getOperationCount(60 * 60 * 1000);
      info['loaded_docs_count'] = documentManager.documents.size;
      info['last_doc_saving_count'] = documentManager.lastSavingInfo.count || 0;
      info['last_doc_saving_start_time'] = documentManager.lastSavingInfo.startTime || null;
      info['last_doc_saving_end_time'] = documentManager.lastSavingInfo.endTime || null;
      res.send({ info: info });
      return;
    } catch (err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Get info error`);
      res.status(500).send({ 'error_msg': 'Internal Server Error' });
      return;
    }
  }

}

const systemController = new SystemController();

export default systemController;
