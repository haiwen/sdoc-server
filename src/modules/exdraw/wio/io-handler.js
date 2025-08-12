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
    this.ioHelper.sendInitRoomToPrivate(socket.id);
    socket.on('join-room', async (params) => {
      // join room
      const { doc_uuid: docUuid, user: userInfo } = params;
      socket.join(docUuid);

      const usersManager = UsersManager.getInstance();
      if (!usersManager.getUser(docUuid, socket.id)) {
        usersManager.addUser(docUuid, socket.id, userInfo);
      }

      const users = usersManager.getDocUsers(docUuid);

      // if (users.length === 1) {
      // this.ioHelper.sendFirstInRoomMessage(socket.id);
      // } else {
      //   this.ioHelper.sendNewUserMessage(socket, docUuid);
      // }

      this.ioHelper.sendRoomUserChangeMessage(socket, docUuid, users);
    });

    socket.on('elements-updated', async (params, callback) => {
      const { doc_uuid: docUuid, ...rest } = params;
      const excalidrawManager = ExcalidrawManager.getInstance();
      const result = await excalidrawManager.execOperationsBySocket(params);
      if (result.success) {
        const { version } = result;
        rest.version = version;
        this.ioHelper.sendElementsMessageToRoom(socket, docUuid, rest);
      }
      callback && callback(result);
    });

    socket.on('mouse-location-updated', async (params) => {
      const { doc_uuid: docUuid, ...rest } = params;
      this.ioHelper.sendMouseMessageToRoom(socket, docUuid, rest);
    });

    socket.on('server-volatile-broadcast', (params) => {
      const { doc_uuid: docUuid, elements } = params;
      this.ioHelper.sendMessageToRoom(socket, docUuid, { elements });
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
