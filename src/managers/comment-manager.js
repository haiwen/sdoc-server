import { deleteComment, insertComment, listComments, updateComment } from "../dao/comment";

class CommentManager {

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new CommentManager();
    return this.instance;
  };

  listComments = async (docUuid) => {
    const comments = await listComments(docUuid);
    return comments;
  };

  insertComment = async (docUuid, comment) => {
    const _comment = await insertComment(docUuid, comment);
    return _comment;
  };
  
  deleteComment = async (commentId) => {
    const comment = await deleteComment(commentId);
    return comment;
  };

  updateComment = async (commentId, comment) => {
    const _comment = await updateComment(commentId, comment);
    return _comment;
  };

}

export default CommentManager;
