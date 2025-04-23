import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../../../config/config';

function checkPermission(socket) {
  try {
    jwt.verify(socket.authToken, SEADOC_PRIVATE_KEY);
    return true;
  } catch(err) {
    return false;
  }
}

export default checkPermission;
