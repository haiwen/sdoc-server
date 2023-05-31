import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import logger from '../loggers';

// web-socket 请求的验证中间件，类似 http 请求验证，请求体获取数据形式不一样
export default function(socket, next) {
  // 从 handshake 获取 Token
  const { token } = socket.handshake.auth || '';
  try {
    // jwt 验证
    const decoded = jwt.verify(token, SEADOC_PRIVATE_KEY);
    // 把验证后的信息，绑定到 socket 对象上（uuid, name, permission）
    socket.docUuid = decoded.file_uuid;
    socket.docName = decoded.filename;
    socket.userInfo = { 
      username: decoded.username, 
      permission: decoded.permission,
      name: decoded.name,
      avatar_url: decoded.avatar_url
    };
    socket.payload = decoded;
  } catch (err) {
    // 验证失败，返回操作，执行后面的操作
    logger.error(err.message);
    next(err);
    return;
  }
  // 验证成功，继续执行后面的操作
  next();
}
