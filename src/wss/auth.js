import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import logger from '../loggers';

export default function(socket, next) {
  const { token } = socket.handshake.auth || '';
  try {
    const decoded = jwt.verify(token, SEADOC_PRIVATE_KEY);
    socket.docUuid = decoded.file_uuid;
    socket.userInfo = { username: decoded.username, permission: decoded.permission };
    socket.payload = decoded;
  } catch (err) {
    logger.error(err.message);
    next(err);
    return;
  }
  next();
}
