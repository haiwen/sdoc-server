import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import logger from '../loggers';

const EVENT_PERMISSIONS = new Map([
  ['join-room', 'r'],
  ['leave-room', 'r'],
  ['sync-document', 'r'],
  ['update-cursor', 'r'],
  ['user-updated', 'r'],
  ['reload-image', 'r'],
  ['mouse-location-updated', 'r'],
  ['update-document', 'rw'],
  ['server-error', 'rw'],
  ['elements-updated', 'rw'],
  ['server-volatile-broadcast', 'rw'],
]);

export default function(socket, next) {
  const { token } = socket.handshake.auth || {};
  try {
    const decoded = jwt.verify(token, SEADOC_PRIVATE_KEY, { algorithms: ['HS256'] });
    if (!decoded || typeof decoded !== 'object' ||
        typeof decoded.file_uuid !== 'string' || !decoded.file_uuid.trim() ||
        typeof decoded.username !== 'string' || !decoded.username.trim() ||
        !['r', 'rw'].includes(decoded.permission) ||
        !Number.isFinite(decoded.exp) ||
        (decoded.token_type !== undefined && decoded.token_type !== 'collaboration')) {
      throw new Error('Invalid collaboration token');
    }

    socket.docUuid = decoded.file_uuid;
    socket.docName = decoded.filename;
    socket.userInfo = {
      username: decoded.username,
      permission: decoded.permission,
      name: decoded.name,
      avatar_url: decoded.avatar_url
    };
    socket.payload = Object.freeze(decoded);
    socket.authToken = token;

    socket.use((packet, next) => {
      const [event] = packet;
      const lastArgument = packet[packet.length - 1];
      const callback = typeof lastArgument === 'function' ? lastArgument : undefined;
      const params = packet[1] === undefined || typeof packet[1] === 'function' ? {} : packet[1];
      const requiredPermission = EVENT_PERMISSIONS.get(event);
      let error;
      if (decoded.exp * 1000 <= Date.now()) {
        error = 'token_expired';
      } else if (socket.disconnected) {
        error = 'permission_denied';
      }
      if (!error && !requiredPermission) {
        error = 'unsupported_event';
      }
      if (!error && (!params || typeof params !== 'object' || Array.isArray(params))) {
        error = 'invalid_params';
      }
      if (!error && (
        (Object.prototype.hasOwnProperty.call(params, 'doc_uuid') && params.doc_uuid !== socket.docUuid) ||
        (requiredPermission === 'rw' && socket.payload.permission !== 'rw')
      )) {
        error = 'permission_denied';
      }
      if (error) {
        callback && callback({ success: false, error_type: error });
        if (error === 'token_expired') socket.disconnect();
        return;
      }

      // Normalize legacy callback-only events without wrapping their listeners.
      packet.splice(1, packet.length - 1, params, callback);
      next();
    });
  } catch (err) {
    logger.debug(err.message);
    next(err);
    return;
  }
  next();
}
