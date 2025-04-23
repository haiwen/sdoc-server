import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import exdrawController from './controllers/exdraw-controller';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, exdrawController.loadSceneContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, multipartMiddleware, exdrawController.saveSceneContent);


export default router;
