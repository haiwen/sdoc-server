import jwt from 'jsonwebtoken';
import logger from '../loggers';
import { SEADOC_PRIVATE_KEY } from '../config/config';
import { getDocUuidFromUrl } from '../utils';

// 批准授权（中间件）
const auth = (req, res, next) => {

  const authorization = req.headers.authorization;
  // 需要的请求头包含 headers: { 'Authorization': 'Token ' + accessToken }，如果没有这个字段，403
  if (!authorization || !authorization.split(' ')[1]) {
    res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
    return;
  }

  // 获取 token
  const token = authorization.split(' ')[1];

  // 使用秘钥进行验证
  jwt.verify(token, SEADOC_PRIVATE_KEY, {algorithms: ['HS256']}, function(err, decoded) {
    // 验证失败
    if (err || !decoded) {
      logger.error(err.message);
      // Token 过期，其他情况都是没有权限
      if (err.name === 'TokenExpiredError') {
        res.status(403).send({"error_msg": 'Token expired.'});
        return;
      } else {
        res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
        return;
      }
    }

    // 验证通过
    // 从 URL 解析出 doc-uuid
    const doc_uuid = getDocUuidFromUrl(req.originalUrl);

    // 使用管理员权限启动的访问请求
    // access request initiated with administrator privileges
    if (!doc_uuid) {
      // write jwt token to the req object
      // 如果 URL 中没有 UUID，那么把 jwt token 放入 request 对象中
      req.payload = decoded;
      next();
    } else {
      // TODO: access_token file_uuid to doc_id
      // token's uuid is file_uud
      const { file_uuid: docUuid } = decoded;
      // 如果 jwt 解析后的 UUID 和 URL 中的 UUID 不一致，那么提示错误，不匹配，返回 403
      if (docUuid !== doc_uuid) {
        const message = `doc_uuid in token doesn't match the accessed doc. doc_uuid in token: ${docUuid}, accessed doc_uuid: ${doc_uuid}`;
        logger.info(message);
        res.status(403).send({"error_msg": 'You don\'t have permission to access.'});
        return;
      }

      // 如果 jwt 解析后的 UUID 和 URL 中的 UUID 一致，将 jwtToken 写入返回对象，继续执行
  
      // write jwt token to the req object
      req.payload = decoded;
      next();
    }

  });
};

export default auth;
