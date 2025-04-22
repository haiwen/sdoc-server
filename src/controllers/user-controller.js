import logger from "../loggers";
import UsersManager from '../managers/users-manager';
import { isRequestTimeout } from "../utils";

class UserController {

  async getCollaborators(req, res) {
    const { doc_uuid: docUuid } = req.params;

    try {
      const usersManager = UsersManager.getInstance();
      const collaborators = await usersManager.getDocUsers(docUuid);
      res.send({collaborators: collaborators});
      return;
    } catch(err) {
      logger.error(err.message);
      if (isRequestTimeout(err)) {
        logger.error('Request timed out, please try again later');
      }
      logger.error(`Load ${docUuid} collaborators error`);
      res.status(500).send({'error_msg': 'Internal Server Error'});
      return;
    }
  }
  
}

const userController = new UserController();

export default userController;
