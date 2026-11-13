import jwt from 'jsonwebtoken';
import logger from '../loggers';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import { getDocUuidFromUrl } from '../utils';

const isElementCommandRequest = req => {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  return /^\/api\/v1\/docs\/[^/]+\/element-commands$/.test(path);
};

const rejectRequest = (req, res, message) => {
  const body = isElementCommandRequest(req) ? { error_code: 'permission_denied' } : { error_msg: message };
  res.status(403).send(body);
};

const auth = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.split(' ')[1]) {
    rejectRequest(req, res, 'You don\'t have permission to access.');
    return;
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, SEADOC_PRIVATE_KEY, {algorithms: ['HS256']}, function(err, decoded) {
    if (err || !decoded) {
      logger.error(err ? err.message : 'Invalid token payload');
      if (err && err.name === 'TokenExpiredError') {
        res.status(403).send({"error_msg": 'Token expired.'});
        return;
      } else {
        rejectRequest(req, res, 'You don\'t have permission to access.');
        return;
      }
    }

    const doc_uuid = getDocUuidFromUrl(req.originalUrl);
    // Only the explicit system info endpoint accepts an unbound administrator token.
    const isSystemInfoRequest = (req.method === 'GET' || req.method === 'HEAD') &&
      /^\/api\/v1\/docs\/system\/info\/?$/i.test(req.path);
    const isAuthorized = isSystemInfoRequest
      ? decoded.admin === true
      : doc_uuid && decoded.file_uuid === doc_uuid;
    if (!isAuthorized) {
      logger.info('Token does not authorize access to the requested document or system endpoint');
      res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
      return;
    }

    // write jwt token to the req object
    req.payload = decoded;
    next();

  });
};

export default auth;
