import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { documentController, userController } from './controllers';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.loadDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, multipartMiddleware, documentController.saveDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/internal-refresh-doc`, documentController.internalRefreshDoc);

router.get(`${BASE_URL_VERSION1}/:doc_uuid/collaborators`, userController.getCollaborators);

export default router;
