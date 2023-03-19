import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { SEAHUB_SERVER } from '../config/config';

class SeaServerAPI {

  getConfig = (accessToken) => {
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + accessToken },
    };
    return config;
  };

  getFileDownloadLink = (accessToken, fileUuid) => {
    const config = this.getConfig(accessToken);
    const url = '/api/v2.1/seadoc/download-link/' + fileUuid + '/';
    return axios.get(url, config);
  };

  getFileUpdateLink = (accessToken, fileUuid) => {
    const config = this.getConfig(accessToken);
    const url = '/api/v2.1/seadoc/upload-link/' + fileUuid + '/';
    return axios.get(url, config);
  };

  getFileContent = (accessToken, fileUuid) => {
    return this.getFileDownloadLink(accessToken, fileUuid).then(res => {
      const { download_link: downloadLink } = res.data;
      return axios.get(downloadLink);
    });
  };
    
  saveFileContent = (accessToken, fileUuid, filePath, fileName, fileData) => {    
    return this.getFileUpdateLink(accessToken, fileUuid).then(res => {

      const { upload_link: uploadLink } = res.data;
      const formData = new FormData();
      formData.append("target_file", filePath);
      formData.append("filename", fileName);
      formData.append("file", fs.createReadStream(fileData.path), {fileName: fileName});

      return axios.post(uploadLink, formData, {headers: { 'Authorization': 'Token ' + accessToken }});
    });
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
