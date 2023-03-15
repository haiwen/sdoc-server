import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { documentController } from './controllers';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(BASE_URL_VERSION1, documentController.loadFileContent);
router.post(BASE_URL_VERSION1, multipartMiddleware, documentController.saveFileContent);

export default router;
