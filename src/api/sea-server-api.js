import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../config/config';

// axios 全局设置网络超时为 60 秒，请求时间超出设置时间后，如果没有请求成功，就执行错误函数。
axios.defaults.timeout = 60 * 1000;

// seahub API（sdoc-server 向 seahub 发出请求）
class SeaServerAPI {

  // 本地使用 docUUID 生成 JWT token（accessToken）
  generateJwtToken = (docUuid) => {
    // TODO: update file_uuid to doc_uuid
    const payload = {
      // 过期时间 5 分钟？
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission: 'rw',
      file_uuid: docUuid,
    };
    // 生成token
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY);
    return token;
  };

  // 获取 API 的设置项
  getConfig = (docUuid) => {
    // 使用 uuid 生成 JWT token (accessToken)
    const accessToken = this.generateJwtToken(docUuid);
    // 设置项：baseURL 是 seahub, 验证中增加 accessToken
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + accessToken },
    };
    return config;
  };

  // 获取下载链接
  getDocDownloadLink = (docUuid) => {
    const config = this.getConfig(docUuid);
    const url = '/api/v2.1/seadoc/download-link/' + docUuid + '/';
    // 获取 URL 和配置，get 获取下载链接
    return axios.get(url, config);
  };

  // 获取上传链接
  getDocUpdateLink = (docUuid) => {
    const config = this.getConfig(docUuid);
    const url = '/api/v2.1/seadoc/upload-link/' + docUuid + '/';
    return axios.get(url, config);
  };

  // 获取文本内容 return Promise，先获取下载链接，然后执行下载操作
  getDocContent = (docUuid) => {
    return this.getDocDownloadLink(docUuid).then(res => {
      const { download_link: downloadLink } = res.data;
      return axios.get(downloadLink);
    });
  };
    
  // 保存文本内容
  // 创建上传链接，使用 formData 表单数据上传，包括文本内容和最后更改人
  saveDocContent = (docUuid, docData, lastModifyUser) => {   
    const uploadLink = '/api/v2.1/seadoc/upload-file/' + docUuid + '/';

    const formData = new FormData();
    // 文件内容使用 fs 模块从路径中读取
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

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
