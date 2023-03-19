import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../config/config';

class SeaServerAPI {

  generateJwtToken = (fileUuid) => {
    const payload = {
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission: 'rw',
      file_uuid: fileUuid,
    };
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY);
    return token;
  };

  getConfig = (fileUuid) => {
    const accessToken = this.generateJwtToken(fileUuid);
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + accessToken },
    };
    return config;
  };

  getFileDownloadLink = (fileUuid) => {
    const config = this.getConfig(fileUuid);
    const url = '/api/v2.1/seadoc/download-link/' + fileUuid + '/';
    return axios.get(url, config);
  };

  getFileUpdateLink = (fileUuid) => {
    const config = this.getConfig(fileUuid);
    const url = '/api/v2.1/seadoc/upload-link/' + fileUuid + '/';
    return axios.get(url, config);
  };

  getFileContent = (fileUuid) => {
    return this.getFileDownloadLink(fileUuid).then(res => {
      const { download_link: downloadLink } = res.data;
      return axios.get(downloadLink);
    });
  };
    
  saveFileContent = (fileUuid, filePath, fileName, fileData) => {    
    return this.getFileUpdateLink(fileUuid).then(res => {

      const { upload_link: uploadLink } = res.data;
      const formData = new FormData();
      formData.append("target_file", filePath);
      formData.append("filename", fileName);
      formData.append("file", fs.createReadStream(fileData.path), {fileName: fileName});

      return axios.post(uploadLink, formData);
    });
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
