import express from 'express';
import { BASE_URL_VERSION1 } from './constants';
import { commentController, documentController, replyController, userController, systemController, participantController } from './controllers';
import formdata from '../../middleware/formdata';

const router = express.Router();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.loadDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, formdata.single('doc_content'), documentController.saveDocContent);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.removeContent);
router.get(`${BASE_URL_VERSION1}/:doc_uuid/normalize-sdoc`, documentController.normalizeSdoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/save/`, formdata.none(), documentController.saveDoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/publish/`, formdata.fields([{name: 'origin_doc_uuid', maxCount: 1}, {name: 'origin_doc_name', maxCount: 1}]), documentController.publishDoc);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/replace/`, formdata.single('doc_name'), documentController.reloadDoc);

router.get(`${BASE_URL_VERSION1}/:doc_uuid/collaborators`, userController.getCollaborators);

// comment
router.get(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.listComments);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/comment/`, commentController.insertComment);
router.delete(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.deleteComment);
router.put(`${BASE_URL_VERSION1}/:doc_uuid/comment/:comment_id/`, commentController.updateComment);

// reply
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
