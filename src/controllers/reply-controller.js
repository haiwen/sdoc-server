import seaServerAPI from "../api/sea-server-api";
import logger from "../loggers";
import { isRequestTimeout } from "../utils";
import { internalServerError, paramIsRequired } from "../utils/resp-message-utils";
import NotificationManager from "../managers/notification-manager";

class ReplyController {

  async listReplies(req, res) {
    const { doc_uuid: docUuid, comment_id: commentId } = req.params;

    try {
      const result = await seaServerAPI.listReplies(docUuid, commentId);
      const { replies } = result.data;
      res.send({ replies });
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Load ${docUuid} replies error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async insertReply(req, res) {
    const { doc_uuid: docUuid, comment_id: commentId } = req.params;
    
    const { type, reply, author } = req.body;

    if (!type) {
      return res.status(400).send(paramIsRequired('type'));
    }

    if (!reply && reply !== false) {
      return res.status(400).send(paramIsRequired('reply'));
    }

    if (!author) {
      return res.status(400).send(paramIsRequired('author'));
    }

    try {
      const result = await seaServerAPI.insertReply(docUuid, commentId, { type, reply, author });
      const _reply = result.data;
      res.send({reply: _reply});
      const notification = result.data.notification;
      const toUsers = notification.to_users;
      if (toUsers.length > 0) {
        const notificationManager = NotificationManager.getInstance();
        for (let username of toUsers) {
          notificationManager.sendNotificationToUser(docUuid, username, notification);
        }
      }
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Insert replay error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async deleteReply(req, res) {
    const { doc_uuid: docUuid, comment_id, reply_id } = req.params;

    try {
      await seaServerAPI.deleteReply(docUuid, comment_id, reply_id);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Delete reply ${reply_id} error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async updateReply(req, res) {
    const { doc_uuid: docUuid, comment_id, reply_id } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).send(paramIsRequired('reply'));
    }

    try {
      await seaServerAPI.updateReply(docUuid, comment_id, reply_id, { reply });
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Update reply ${reply_id} error`);
      res.status(500).send(internalServerError());
      return;
    }
  }
  
}

const replyController = new ReplyController();

export default replyController;
