import logger from "../loggers";
import CommendManager from "../managers/comment-manager";
import { isObject, isRequestTimeout } from "../utils";
import { internalServerError, paramIsError, paramIsRequired } from "../utils/resp-message-utils";

class CommentController {

  async listComments(req, res) {
    const { doc_uuid: docUuid } = req.params;

    try {
      const commentManager = CommendManager.getInstance();
      const comments = await commentManager.listComments(docUuid);
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
    
    const { comment, detail, author, time } = req.body;

    if (!comment) {
      return res.status(400).send(paramIsRequired('comment'));
    }
    
    if (!detail) {
      return res.status(400).send(paramIsRequired('detail'));
    }
    
    if (!isObject(detail) || !detail.element_id) {
      return res.status(400).send(paramIsError('detail'));
    }

    if (!author) {
      return res.status(400).send(paramIsRequired('author'));
    }

    if (!time) {
      return res.status(400).send(paramIsRequired('time'));
    }

    try {
      const commentManager = CommendManager.getInstance();
      const _comment = await commentManager.insertComment(docUuid, { comment, detail, author, time });
      res.send({comment_id: _comment.insertId});
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
    const { comment_id } = req.params;

    try {
      const commentManager = CommendManager.getInstance();
      await commentManager.deleteComment(comment_id);
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
    const { comment_id } = req.params;
    const { comment, detail, time } = req.body;

    if (!comment) {
      return res.status(400).send(paramIsRequired('comment'));
    }
    
    if (!detail) {
      return res.status(400).send(paramIsRequired('detail'));
    }
    
    if (!isObject(detail) || !detail.element_id) {
      return res.status(400).send(paramIsError('detail'));
    }

    if (!time) {
      return res.status(400).send(paramIsRequired('time'));
    }

    try {
      const commentManager = CommendManager.getInstance();
      await commentManager.updateComment(comment_id, { comment, detail, time });
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
