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
    // todo permission check

    socket.on('join-room', (params, callback) => {
      // join room
      const { doc_uuid: docUuid, user: userInfo } = params;
      socket.join(docUuid);

      const usersManager = UsersManager.getInstance();
      if (!usersManager.getUser(docUuid, socket.id)) {
        usersManager.addUser(docUuid, socket.id, userInfo);
      }

      const users = usersManager.getDocUsers(docUuid);
      this.ioHelper.sendRoomUserChangeMessage(socket, docUuid, users);
      callback && callback({ success: true });
    });

    socket.on('server-broadcast', (params, callback) => {
      const { doc_uuid: docUuid, elements } = params;
      this.ioHelper.sendMessageToRoom(socket, docUuid, { elements });
      callback && callback();
    });

    socket.on('server-volatile-broadcast', (params) => {
      const { doc_uuid: docUuid, elements } = params;
      this.ioHelper.sendMessageToRoom(socket, docUuid, { elements });
    });

    socket.on('mouse-location', (params) => {
      const { doc_uuid: docUuid, ...reset } = params;
      this.ioHelper.sendMouseMessageToRoom(socket, docUuid, { ...reset });
    });

    socket.on('leave-room', async () => {
      await this.handleDisconnect(socket);
    });

    socket.on('disconnect', async () => {
      await this.handleDisconnect(socket);
    });
  }

    handleDisconnect = async (socket) => {
      const { docUuid } = socket;
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user);
      }

      // delete current user from memory
      const usersCount = usersManager.deleteUser(docUuid, socket.id);
      const documentManager = ExcalidrawManager.getInstance();
      if (usersCount === 0) {
        // save document first
        await documentManager.saveSceneDoc(docUuid);
      }
    };
}

export default ExdrawIOHandler;
