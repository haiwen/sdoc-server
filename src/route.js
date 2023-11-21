import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { commentController, documentController, replyController, userController, systemController, participantController } from './controllers';

const router = express.Router();
const multipartMiddleware = multipart();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.loadDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, multipartMiddleware, documentController.saveDocContent);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.removeContent);
router.get(`${BASE_URL_VERSION1}/:doc_uuid/normalize-sdoc`, documentController.normalizeSdoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/save/`, multipartMiddleware, documentController.saveDoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/publish/`, multipartMiddleware, documentController.publishDoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/replace/`, multipartMiddleware, documentController.reloadDoc);

router.get(`${BASE_URL_VERSION1}/:doc_uuid/collaborators`, userController.getCollaborators);

// comment 
router.get(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.listComments);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.insertComment);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.deleteComment);
router.put(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.updateComment);

// repay
router.get(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/replies/`, replyController.listReplies);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/replies/`, replyController.insertReply);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/replies/:reply_id/`, replyController.deleteReply);
router.put(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/replies/:reply_id/`, replyController.updateReply);

//system
router.get(`${BASE_URL_VERSION1}/system/info/`, systemController.getInfo);

// participant
router.post(`${BASE_URL_VERSION1}/:doc_uuid/participants/`, participantController.addParticipants);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/participants/`, participantController.removeParticipant);

export default router;
