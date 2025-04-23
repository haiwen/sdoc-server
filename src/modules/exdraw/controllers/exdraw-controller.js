import logger from "../../../loggers";
import { isRequestTimeout } from "../../../utils";

class ExdrawController {

  async loadDocContent(req, res) {

    try {
      res.set('Cache-control', 'no-store');
      res.send('Hello world');
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }

}

const exdrawController = new ExdrawController();

export default exdrawController;
