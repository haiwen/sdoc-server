import IOHelper from '../wio/io-helper';
import { MESSAGE } from '../constants';
import UsersManager from './users-manager';

class ParticipantManager {

  constructor() {
    this.instance = null;
  }

  static getInstance = () => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new ParticipantManager();
    return this.instance;
  };

  addParticipants = (docUuid, users) => {
    const usersManager = UsersManager.getInstance();
    const socketIds = usersManager.getSocketIds(docUuid);
    const ioHelper = IOHelper.getInstance();
    if (socketIds.length > 0) {
      for (let socketId of socketIds) {
        ioHelper.sendParticipantsChanges(socketId, MESSAGE.PARTICIPANT_ADDED, users);
      }
    }
  };

  removeParticipant = (docUuid, email) => {
    const usersManager = UsersManager.getInstance();
    const socketIds = usersManager.getSocketIds(docUuid);
    const ioHelper = IOHelper.getInstance();
    if (socketIds.length > 0) {
      for (let socketId of socketIds) {
        ioHelper.sendParticipantsChanges(socketId, MESSAGE.PARTICIPANT_REMOVED, email);
      }
    }
  };

}

export default ParticipantManager;
