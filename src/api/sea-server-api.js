import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../config/config';

axios.defaults.timeout = 60 * 1000;

class SeaServerAPI {

  generateJwtToken = (docUuid) => {
    // TODO: update file_uuid to doc_uuid
    const payload = {
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission: 'rw',
      file_uuid: docUuid,
    };
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY);
    return token;
  };

  getConfig = (docUuid) => {
    const accessToken = this.generateJwtToken(docUuid);
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

  getDocContent = (docUuid) => {
    return this.getDocDownloadLink(docUuid).then(res => {
      const { download_link: downloadLink } = res.data;
      return axios.get(downloadLink);
    });
  };
    
  saveDocContent = (docUuid, docData, lastModifyUser) => {   
    const uploadLink = '/api/v2.1/seadoc/upload-file/' + docUuid + '/';

    const formData = new FormData();
    formData.append("file", fs.createReadStream(docData.path));
    formData.append("last_modify_user", lastModifyUser);
    
    const config = this.getConfig(docUuid);
    return axios.post(uploadLink, formData, config);
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
