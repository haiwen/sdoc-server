import responseTime from 'response-time';
import { requestTimeLogger, slowRequestTimeLogger } from '../loggers';

export default responseTime((req, res, time) => {
  const costsTime = time ? time.toFixed(1) : 0;
  if (req.method.toLocaleLowerCase() !== 'options') {
    requestTimeLogger.info(req.method, req.url, res.statusCode, `${costsTime}ms`);
    if (costsTime > 500) {
      let requestType = '';
      slowRequestTimeLogger.info(req.method, req.url, requestType, res.statusCode, `${costsTime}ms`);
    }
  }
});