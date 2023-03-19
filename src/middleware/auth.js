import jwt from 'jsonwebtoken';
import logger from '../loggers';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import { getFileUuidFromUrl } from '../utils';

const auth = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.split(' ')[1]) {
    res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
    return;
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, SEADOC_PRIVATE_KEY, {algorithms: ['HS256']}, function(err, decoded) {
    if (err || !decoded) {
      logger.error(err.message);
      if (err.name === 'TokenExpiredError') {
        res.status(403).send({"error_msg": 'Token expired.'});
        return;
      } else {
        res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
        return;
      }
    }

    const file_uuid = getFileUuidFromUrl(req.originalUrl);
    // access request initiated with administrator privileges
    if (!file_uuid) {
      // write jwt token to the req object
      req.payload = decoded;
      next();
    } else {
      if (decoded.file_uuid !== file_uuid) {
        const message = `file_uuid in token doesn't match the accessed file. file_uuid in token: ${decoded.file_uuid}, accessed file_uuid: ${file_uuid}`;
        logger.info(message);
        res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
        return;
      }
  
      // write jwt token to the req object
      req.payload = decoded;
      req.access_token = token;
      next();
    }

  });
};

export default auth;
