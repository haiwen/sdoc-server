import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { fileContentController } from './controllers';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(BASE_URL_VERSION1, fileContentController.loadFileContent);
router.post(BASE_URL_VERSION1, multipartMiddleware, fileContentController.saveFileContent);

export default router;
