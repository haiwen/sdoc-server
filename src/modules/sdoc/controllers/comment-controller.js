import logger from "../../../loggers";
import { isObject, isRequestTimeout } from "../../../utils";
import { internalServerError, paramIsError, paramIsRequired } from "../../../utils/resp-message-utils";
import seaServerAPI from "../api/sea-server-api";
import NotificationManager from "../managers/notification-manager";

class CommentController {

  async listComments(req, res) {
    const { doc_uuid: docUuid } = req.params;

    try {
      const result = await seaServerAPI.listComments(docUuid);
      const { comments } = result.data;
      res.send({ comments });
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Load ${docUuid} comments error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async insertComment(req, res) {
    const { doc_uuid: docUuid } = req.params;

    const { comment, detail, author, updated_at } = req.body;

    if (!comment) {
      return res.status(400).send(paramIsRequired('comment'));
    }

    if (!detail) {
      return res.status(400).send(paramIsRequired('detail'));
    }

    if (!isObject(detail) || (!detail.element_id && detail.element_id_list.length === 0)) {
      return res.status(400).send(paramIsError('detail'));
    }

    if (!author) {
      return res.status(400).send(paramIsRequired('author'));
    }

    if (!updated_at) {
      return res.status(400).send(paramIsRequired('updated_at'));
    }

    try {
      const result = await seaServerAPI.insertComment(docUuid, { comment, detail: JSON.stringify(detail), author, updated_at });
      const _comment = result.data;
      res.send({comment: _comment});
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
      logger.error(`Insert comment error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async deleteComment(req, res) {
    const { doc_uuid: docUuid, comment_id } = req.params;

    try {
      await seaServerAPI.deleteComment(docUuid, comment_id);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Delete comment ${comment_id} error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

  async updateComment(req, res) {
    const { doc_uuid: docUuid, comment_id } = req.params;
    const { comment, detail, updated_at, resolved } = req.body;

    let updatedComment = null;

    // update comment state
    if (Object.keys(req.body).includes('resolved')) {
      updatedComment = {
        resolved: resolved ? 'true' : 'false',
      };
    } else {
      if (!comment) {
        return res.status(400).send(paramIsRequired('comment'));
      }

      if (!detail) {
        return res.status(400).send(paramIsRequired('detail'));
      }

      if (!isObject(detail) || (!detail.element_id && detail.element_id_list.length === 0)) {
        return res.status(400).send(paramIsError('detail'));
      }

      if (!updated_at) {
        return res.status(400).send(paramIsRequired('updated_at'));
      }

      updatedComment = {
        comment,
        detail: JSON.stringify(detail),
        updated_at,
      };
    }


    try {
      await seaServerAPI.updateComment(docUuid, comment_id, updatedComment);
      res.send({success: true});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Update comment ${comment_id} error`);
      res.status(500).send(internalServerError());
      return;
    }
  }

}

const commentController = new CommentController();

export default commentController;
