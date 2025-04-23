import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY, SEAHUB_SERVER } from '../../../config/config';

axios.defaults.timeout = 60 * 1000;

class SeaServerAPI {
  generateJwtToken = (exdrawUuid, username) => {
    // TODO: update file_uuid to doc_uuid
    let payload = {
      exp: Math.floor(Date.now() / 1000) + (5 * 60),
      permission: 'rw',
      file_uuid: exdrawUuid,
    };
    if (username) {
      payload.username = username;
    }
    const token = jwt.sign(payload, SEADOC_PRIVATE_KEY);

    return token;
  };

  getConfig = (exdrawUuid, username) => {
    const accessToken = this.generateJwtToken(exdrawUuid, username);
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + accessToken },
    };

    return config;
  };

  getSceneDownloadLink = (exdrawUuid) => {
    const config = this.getConfig(exdrawUuid);
    const url = '/api/v2.1/exdraw/download-link/' + exdrawUuid + '/';

    return axios.get(url, config);
  };

  getSceneContent = (downloadLink) => {
    return axios.get(downloadLink);
  };

  saveSceneContent = (exdrawUuid, docData, lastModifyUser) => {
    const uploadLink = '/api/v2.1/exdraw/upload-file/' + exdrawUuid + '/';
    const formData = new FormData();
    formData.append("file", fs.createReadStream(docData.path));
    formData.append("last_modify_user", lastModifyUser);
    const config = this.getConfig(exdrawUuid);

    return axios.post(uploadLink, formData, config);
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
