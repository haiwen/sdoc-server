import logger from '../../../loggers';
import ExcalidrawManager from "../managers/excalidraw-manager";
import UsersManager from "../managers/users-manager";
import IOHelper from "./io-helper";

class ExdrawIOHandler {

  constructor(io) {
    this.ioHelper = IOHelper.getInstance(io);
    this.instance = null;
  }

  static getInstance = (io) => {
    if (io) {
      this.instance = new ExdrawIOHandler(io);
      return this.instance;
    }
    if (!this.instance) {
      throw new Error('The program execution sequence is wrong, please check the program and correct it');
    }
    return this.instance;
  };

  onConnection(socket) {
    socket.userInfo = {
      ...socket.userInfo,
      _username: socket.payload.username,
      username: socket.payload.name || socket.payload.username,
      avatarUrl: socket.payload.avatar_url,
    };
    this.ioHelper.sendInitRoomToPrivate(socket.id);
    socket.on('join-room', (params, callback = () => {}) => {
      try {
        // join room
        const { docUuid, userInfo } = socket;
        socket.join(docUuid);

        const usersManager = UsersManager.getInstance();
        if (!usersManager.getUser(docUuid, socket.id)) {
          usersManager.addUser(docUuid, socket.id, userInfo);
        }

        const users = usersManager.getDocUsers(docUuid);

        this.ioHelper.sendRoomUserChangeMessage(socket, docUuid, users);
        callback({ success: true });
      } catch (err) {
        logger.error(`Socket event join-room failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('elements-updated', async (params, callback = () => {}) => {
      try {
        const { docUuid, docName } = socket;
        const user = { ...socket.userInfo };
        const rest = { ...params, user };
        delete rest.doc_uuid;
        const excalidrawManager = ExcalidrawManager.getInstance();
        const result = await excalidrawManager.execOperationsBySocket({ ...params, doc_uuid: docUuid, user }, docName);
        if (result.success) {
          const { version } = result;
          rest.version = version;
          // The edit is already applied; online collaborators still need it after the sender disconnects.
          this.ioHelper.sendElementsMessageToRoom(socket, docUuid, rest);
        }
        if (socket.disconnected) return;
        callback(result);
      } catch (err) {
        logger.error(`Socket event elements-updated failed: ${err.message}`);
        if (!socket.disconnected) callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('mouse-location-updated', (params, callback = () => {}) => {
      try {
        const { docUuid } = socket;
        const rest = { ...params, user: { ...socket.userInfo } };
        delete rest.doc_uuid;
        this.ioHelper.sendMouseMessageToRoom(socket, docUuid, rest);
      } catch (err) {
        logger.error(`Socket event mouse-location-updated failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('server-volatile-broadcast', (params, callback = () => {}) => {
      // Legacy broadcasts bypass versioned edits; clients must use elements-updated.
      callback({ success: false, error_type: 'unsupported_event' });
    });

    socket.on('leave-room', async (params, callback = () => {}) => {
      try {
        await this.handleDisconnect(socket);
      } catch (err) {
        logger.error(`Socket event leave-room failed: ${err.message}`);
        callback({ success: false, error_type: 'server_error' });
      }
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

    handleDisconnect = async (socket) => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      const usersCount = user ? usersManager.deleteUser(docUuid, socket.id) : 0;
      await socket.leave(docUuid);
      if (!user) return;
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user);
      }

      // delete current user from memory
      const documentManager = ExcalidrawManager.getInstance();
      if (usersCount === 0) {
        // save document first
        await documentManager.saveSceneDoc(docUuid);
      }
    };
}

export default ExdrawIOHandler;
