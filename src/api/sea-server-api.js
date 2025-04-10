import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../config/config';

axios.defaults.timeout = 60 * 1000;

class SeaServerAPI {

  generateJwtToken = (docUuid, username) => {
    // TODO: update file_uuid to doc_uuid
    let payload = {
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission: 'rw',
      file_uuid: docUuid,
    };
    if (username) {
      payload.username = username;
    }
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY);
    return token;
  };

  getConfig = (docUuid, username) => {
    const accessToken = this.generateJwtToken(docUuid, username);
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + accessToken },
    };
    return config;
  };

  getDocDownloadLink = (docUuid) => {
    const config = this.getConfig(docUuid);
    const url = '/api/v2.1/seadoc/download-link/' + docUuid + '/';
    return axios.get(url, config);
  };

  getDocUpdateLink = (docUuid) => {
    const config = this.getConfig(docUuid);
    const url = '/api/v2.1/seadoc/upload-link/' + docUuid + '/';
    return axios.get(url, config);
  };

  getDocContent = (downloadLink) => {
    return axios.get(downloadLink);
  };

  saveDocContent = (docUuid, docData, lastModifyUser) => {
    const uploadLink = '/api/v2.1/seadoc/upload-file/' + docUuid + '/';

    const formData = new FormData();
    formData.append("file", fs.createReadStream(docData.path));
    formData.append("last_modify_user", lastModifyUser);

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, formData, config);
  };

  listComments = (docUuid) => {
    const uploadLink = '/api/v2.1/seadoc/comments/' + docUuid + '/';

    const config = this.getConfig(docUuid);
    return axios.get(uploadLink, config);
  };

  insertComment = (docUuid, comment) => {
    const uploadLink = '/api/v2.1/seadoc/comments/' + docUuid + '/';
    const data = comment;

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, data, config);
  };

  deleteComment = (docUuid, commentId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/';

    const config = this.getConfig(docUuid);
    return axios.delete(uploadLink, config);
  };

  updateComment = (docUuid, commentId, comment) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/';
    const data = comment;
    const config = this.getConfig(docUuid);
    return axios.put(uploadLink, data, config);
  };

  listReplies = (docUuid, commentId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/replies/';

    const config = this.getConfig(docUuid);
    return axios.get(uploadLink, config);
  };

  insertReply = (docUuid, commentId, reply) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/replies/';
    const data = reply;

    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, data, config);
  };

  deleteReply = (docUuid, commentId, replyId) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/replies/' + replyId + '/';

    const config = this.getConfig(docUuid);
    return axios.delete(uploadLink, config);
  };

  updateReply = (docUuid, commentId, replyId, reply) => {
    const uploadLink = '/api/v2.1/seadoc/comment/' + docUuid + '/' + commentId + '/replies/' + replyId + '/';
    const data = reply;
    const config = this.getConfig(docUuid);
    return axios.put(uploadLink, data, config);
  };

  editorStatusCallback = (docUuid, status) => {
    const url = '/api/v2.1/seadoc/editor-status-callback/' + docUuid + '/';

    const formData = new FormData();
    formData.append("status", status);

    const config = this.getConfig(docUuid);
    return axios.post(url, formData, config);
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
