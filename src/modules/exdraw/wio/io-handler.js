import ExcalidrawManager from "../managers/excalidraw-manager";
import UsersManager from "../managers/users-manager";
import IOHelper from "./io-helper";
import checkPermission from "./is-permission-valid";

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
    socket.on('join-room', async () => {
      // The document and user are bound to the authenticated socket.
      const docUuid = socket.docUuid;
      const userInfo = socket.userInfo;
      if (!docUuid) return;

      await socket.join(docUuid);

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

    socket.on('elements-updated', async (params = {}, callback) => {
      const docUuid = socket.docUuid;
      if (!docUuid || !socket.rooms || !socket.rooms.has(docUuid)) {
        callback && callback({
          success: false,
          error_type: 'room_not_joined',
          operation_id: params?.operation_id,
        });
        return;
      }

      const isValid = checkPermission(socket);
      if (!isValid) {
        const result = {
          success: false,
          error_type: 'token_expired',
          operation_id: params?.operation_id,
        };
        callback && callback(result);
        return;
      }

      const { elements, version, operation_id: operationId } = params;
      const operationParams = {
        elements,
        version,
        operation_id: operationId,
      };
      const excalidrawManager = ExcalidrawManager.getInstance();
      const result = await excalidrawManager.execOperationsBySocket(socket, operationParams);
      if (result.success && !result.is_duplicate) {
        this.ioHelper.sendElementsMessageToRoom(socket, docUuid, {
          elements,
          version: result.version,
          operation_id: operationId,
          user: socket.userInfo,
        });
      }
      callback && callback(result);
    });

    socket.on('mouse-location-updated', async (params = {}) => {
      const docUuid = socket.docUuid;
      if (!docUuid || !socket.rooms || !socket.rooms.has(docUuid)) return;

      const rest = { ...params, user: socket.userInfo };
      delete rest.doc_uuid;
      this.ioHelper.sendMouseMessageToRoom(socket, docUuid, rest);
    });

    socket.on('server-volatile-broadcast', (params = {}) => {
      const docUuid = socket.docUuid;
      if (!docUuid || !socket.rooms || !socket.rooms.has(docUuid)) return;

      const { elements } = params;
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
