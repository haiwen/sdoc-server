import express from 'express';
import multipart from 'connect-multiparty';
import { BASE_URL_VERSION1 } from './constants';
import { commentController, documentController, replyController, userController } from './controllers';

const router = express.Router();

// connect-multiparty 这个中间件用于上传文件
// 前端用multipart/form-data的形式上传数据，后端通过中间件connect-multipary接收。
// 注意，接收结果req.files是一个对象，包含POST上传的参数和一个临时文件，文件一般在/tmp目录下，可以将文件移动到指定位置。
// 参考 https://blog.csdn.net/dreamer2020/article/details/52076391
const multipartMiddleware = multipart();

// doc GET 请求，返回文件内容
router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, documentController.loadDocContent);

// doc POST 请求，保存文件内容，使用 connect-multiparty 这个中间件简化文件操作
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, multipartMiddleware, documentController.saveDocContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/internal-refresh-docs`, documentController.internalRefreshDocs);
router.get(`${BASE_URL_VERSION1}/:doc_uuid/normalize-sdoc`, documentController.normalizeSdoc);

// GET 请求获取协作人列表
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


export default router;
