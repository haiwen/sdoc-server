import jwt from 'jsonwebtoken';
import logger from '../loggers';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import { getDocUuidFromUrl } from '../utils';

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

    const doc_uuid = getDocUuidFromUrl(req.originalUrl);
    // access request initiated with administrator privileges
    if (!doc_uuid) {
      // write jwt token to the req object
      req.payload = decoded;
      next();
    } else {
      // TODO: access_token file_uuid to doc_id
      // token's uuid is file_uud
      const { file_uuid: docUuid } = decoded;
      if (docUuid !== doc_uuid) {
        const message = `doc_uuid in token doesn't match the accessed doc. doc_uuid in token: ${docUuid}, accessed doc_uuid: ${doc_uuid}`;
        logger.info(message);
        res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
        return;
      }
  
      // write jwt token to the req object
      req.payload = decoded;
      next();
    }

  });
};

export default auth;
