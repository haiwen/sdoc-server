import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import logger from '../loggers';

export default function(socket, next) {
  const { token } = socket.handshake.auth || '';
  try {
    const decoded = jwt.verify(token, SEADOC_PRIVATE_KEY);
    socket.docUuid = decoded.file_uuid;
    socket.docName = decoded.filename;
    socket.userInfo = {
      username: decoded.username,
      permission: decoded.permission,
      name: decoded.name,
      avatar_url: decoded.avatar_url
    };
    socket.payload = decoded;
    socket.authToken = token;
  } catch (err) {
    logger.debug(err.message);
    next(err);
    return;
  }
  next();
}
