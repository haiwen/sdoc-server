import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../../../config/config';
import { encodePathSegment, validateDownloadLink } from '../../../utils/seahub-url';

axios.defaults.timeout = 60 * 1000;

class SeaServerAPI {

  generateJwtToken = (docUuid, username, permission = 'rw') => {
    // TODO: update file_uuid to doc_uuid
    let payload = {
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission,
      file_uuid: docUuid,
      token_type: 'service',
    };
    if (username) {
      payload.username = username;
    }
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY, { algorithm: 'HS256' });
    return token;
  };

  getConfig = (docUuid, username, permission = 'rw') => {
    const accessToken = this.generateJwtToken(docUuid, username, permission);
    const config = {
      baseURL: SEAHUB_SERVER,
      allowAbsoluteUrls: false,
      maxRedirects: 0,
      headers: { 'Authorization': 'Token ' + accessToken },
    };
    return config;
  };

  getDocDownloadLink = (docUuid) => {
    const config = this.getConfig(docUuid, undefined, 'r');
    const url = '/api/v2.1/seadoc/download-link/' + encodePathSegment(docUuid) + '/';
    return axios.get(url, config);
  };

  getDocUpdateLink = (docUuid) => {
    const config = this.getConfig(docUuid);
    const url = '/api/v2.1/seadoc/upload-link/' + encodePathSegment(docUuid) + '/';
    return axios.get(url, config);
  };

  getDocContent = (downloadLink) => {
    return axios.get(validateDownloadLink(downloadLink), { maxRedirects: 0 });
  };

  saveDocContent = (docUuid, docData, lastModifyUser) => {
    const uploadLink = '/api/v2.1/seadoc/upload-file/' + encodePathSegment(docUuid) + '/';

    const formData = new FormData();
    formData.append("file", fs.createReadStream(docData.path));
    formData.append("last_modify_user", lastModifyUser);

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, formData, config);
  };

  listComments = (docUuid) => {
    const uploadLink = '/api/v2.1/seadoc/comments/' + encodePathSegment(docUuid) + '/';

    const config = this.getConfig(docUuid, undefined, 'r');
    return axios.get(uploadLink, config);
  };

  insertComment = (docUuid, comment) => {
    const uploadLink = '/api/v2.1/seadoc/comments/' + encodePathSegment(docUuid) + '/';
    const data = comment;

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, data, config);
  };

  deleteComment = (docUuid, commentId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/';

    const config = this.getConfig(docUuid);
    return axios.delete(uploadLink, config);
  };

  updateComment = (docUuid, commentId, comment) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/';
    const data = comment;
    const config = this.getConfig(docUuid);
    return axios.put(uploadLink, data, config);
  };

  listReplies = (docUuid, commentId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/replies/';

    const config = this.getConfig(docUuid, undefined, 'r');
    return axios.get(uploadLink, config);
  };

  insertReply = (docUuid, commentId, reply) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/replies/';
    const data = reply;

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, data, config);
  };

  deleteReply = (docUuid, commentId, replyId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/replies/' + encodePathSegment(replyId) + '/';

    const config = this.getConfig(docUuid);
    return axios.delete(uploadLink, config);
  };

  updateReply = (docUuid, commentId, replyId, reply) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + encodePathSegment(docUuid) + '/' + encodePathSegment(commentId) + '/replies/' + encodePathSegment(replyId) + '/';
    const data = reply;
    const config = this.getConfig(docUuid);
    return axios.put(uploadLink, data, config);
  };

  editorStatusCallback = (docUuid, status) => {
    const url = '/api/v2.1/seadoc/editor-status-callback/' + encodePathSegment(docUuid) + '/';

    const formData = new FormData();
    formData.append("status", status);

    const config = this.getConfig(docUuid);
    return axios.post(url, formData, config);
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
