import ExcalidrawManager from "../managers/excalidraw-manager";
import UsersManager from "../managers/users-manager";
import IOHelper from "./io-helper";
import checkPermission from "./is-permission-valid";

const isValidPreviewPayload = (params) => {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return false;
  }

  const { gestureId, seq, elements } = params;
  return (
    typeof gestureId === 'string' &&
    gestureId.length > 0 &&
    gestureId.length <= 128 &&
    Number.isInteger(seq) &&
    seq >= 1 &&
    Array.isArray(elements) &&
    elements.length > 0 &&
    elements.every((element) => (
      element &&
      typeof element === 'object' &&
      typeof element.id === 'string' &&
      element.id.length > 0
    ))
  );
};

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
    socket.on('join-room', async (params = {}, callback) => {
      const respond = typeof callback === 'function' ? callback : () => {};
      const { doc_uuid: docUuid, user: userInfo } = params;

      if (!docUuid || !userInfo) {
        respond({
          success: false,
          error_type: 'invalid_join_room',
        });
        return;
      }

      try {
        // Wait until the socket is actually in the document room before
        // acknowledging the handshake. This prevents clients from sending
        // operations to a transport that has not joined the room yet.
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
        respond({
          success: true,
          doc_uuid: docUuid,
        });
      } catch (error) {
        respond({
          success: false,
          error_type: 'join_room_error',
        });
      }
    });

    socket.on('elements-updated', async (params, callback) => {
      const isValid = checkPermission(socket);
      if (!isValid) {
        const result = {
          success: false,
          error_type: 'token_expired',
        };
        callback && callback(result);
        return;
      }

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

    socket.on('server-volatile-broadcast', (params = {}) => {
      if (!isValidPreviewPayload(params)) {
        return;
      }

      // Room membership can outlive the token that established the socket.
      // Revalidate the token before forwarding a preview to other clients.
      const isValid = checkPermission(socket);
      if (!isValid) {
        return;
      }

      const { doc_uuid: docUuid } = params;
      if (docUuid !== socket.docUuid || !socket.rooms.has(docUuid)) {
        return;
      }

      const rest = { ...params };
      delete rest.doc_uuid;
      this.ioHelper.sendPreviewElementsMessageToRoom(socket, docUuid, rest);
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
