import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { commentController, documentController, userController } from './controllers';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.loadDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, multipartMiddleware, documentController.saveDocContent);

router.get(`${BASE_URL_VERSION1}/:doc_uuid/collaborators`, userController.getCollaborators);

// comment
router.get(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.listComments);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.insertComment);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.deleteComment);
router.put(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.updateComment);

export default router;
