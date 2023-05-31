import { OPERATIONS_CACHE_LIMIT } from "../constants";
import logger from "../loggers";
import DocumentManager from "../managers/document-manager";
import OperationsManager from "../managers/operations-manager";
import UsersManager from "../managers/users-manager";
import auth from "./auth";
import IOHelper from "./io-helper";

// socket 服务器
class IOServer {

  constructor(io) {
    // 连接数
    this.connectCount = 0;
    this.io = io;
    this.ioHelper = IOHelper.getInstance(io);
    // 发生 web-socket 连接事件（ws不中断链接），回调函数中，根据具体的操作名称，处理各种信息
    io.on('connection', (socket) => { this.onConnected(socket); });
    // 认证中间件
    io.use(auth);
  }

  // 建立连接后的回调函数
  onConnected(socket) {
    
    this.connectCount++;

    // todo permission check

    // 加入房间
    socket.on('join-room', async (callback) => {
      
      let docContent = null;
      const { docUuid, docName } = socket;
      try {
        // 获取当前的 doc 内容，加载到内存中
        // get doc content and add doc into memory
        const documentManager = DocumentManager.getInstance();
        docContent = await documentManager.getDoc(docUuid, docName);
      } catch(err) {
        logger.error(`SOCKET_MESSAGE: Load ${docName}(${docUuid}) doc content error`);
        callback && callback({success: 0});
        return;
      }
      
      // 加入到 socket 中
      // join room
      socket.join(docUuid);

      // 把当前用户加载到内存中
      // add current user into memory
      const { userInfo } = socket;
      const usersManager = UsersManager.getInstance();
      usersManager.addUser(docUuid, socket.id, userInfo);

      // 发送某人进入房间的消息
      this.ioHelper.sendJoinRoomMessage(socket, docUuid, userInfo);

      // const sid = socket.id;
      // this.ioHelper.sendMessageToPrivate(sid, params);

      // 如果有回调函数，返回成功
      const { version } = docContent;
      callback && callback({success: 1, version});
    });
    
    // 离开房间
    socket.on('leave-room', async () => {
      const { docUuid } = socket;
      // 发出用户离开房间的信息
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      }
      
      // 从内存中删除掉当前的用户
      // delete current user from memory
      const usersCount = usersManager.deleteUser(docUuid, socket.id);
      const documentManager = DocumentManager.getInstance();
      // 删除鼠标
      user && documentManager.deleteCursor(docUuid, user);

      // 如果已经没有用户访问了，那么保存文档
      if (usersCount === 0) {
        const savedBySocket = true;
        await documentManager.saveDoc(docUuid, savedBySocket);
      }
    });
    
    // 更新文档事件，执行操作
    socket.on('update-document', async (params, callback) => {
      const { docName } = socket;
      const { doc_uuid: docUuid, operations, user, selection, cursor_data } = params;
      const documentManager = DocumentManager.getInstance();
      try {
        // Load the document before executing op to avoid the document not being loaded into the memory after disconnection and reconnection
        await documentManager.getDoc(docUuid, docName);
      } catch(e) {
        logger.error(`SOCKET_MESSAGE: Load ${docName}(${docUuid}) doc content error`);
        const result = {
          success: false,
          error_type: 'document_content_load_failed',
          operations: operations
        };
        callback && callback(result);
        return;
      }
      // 执行操作
      documentManager.execOperationsBySocket(params, (result) => {
        if (result.success) {
          const { version } = result;
          // 将执行结果返回到客户端
          this.ioHelper.sendMessageToRoom(socket, docUuid, {operations, version, user, selection, cursor_data});
        }
        callback && callback(result);
      });
    });

    // 更新鼠标位置
    socket.on('update-cursor', (params) => {
      // update cursor
      const documentManager = DocumentManager.getInstance();
      documentManager.setCursorLocation(params);

      // send message to others
      const { doc_uuid: docUuid, user, location, cursor_data } = params;
      this.ioHelper.sendCursorMessageToRoom(socket, docUuid, {user, location, cursor_data});
    });

    // 客户端请求同步文档
    socket.on('sync-document', async (params, callback) => {
      const { docName } = socket;
      const { doc_uuid: docUuid } = params;
      const documentManager = DocumentManager.getInstance();
      const docContent = await documentManager.getDoc(docUuid, docName);
      const { version: serverVersion } = docContent;
      const { version: clientVersion } = params;

      // 获取服务器的版本，和客户端的版本
      
      // 如果服务器版本和客户端版本差距，大于缓存数量限制（1000），直接把整个文档返回客户端（断线重连后，新的 OP 超过1000个，需要重新获取全部文档）
      // return document
      if (serverVersion - clientVersion > OPERATIONS_CACHE_LIMIT) {
        const result = {
          success: true,
          mode: 'document',
          content: docContent
        };
        callback && callback(result);
        return;
      }

      // 如果客户端和服务器版本差距小于1000，那么从缓存中获取遗漏的 operations 然后返回客户端（这样只返回 OPs），例如 20个 OP
      // return operations
      const operationsManager = OperationsManager.getInstance();
      const operationList = operationsManager.getLoseOperationList(docUuid, clientVersion);
      const result = {
        success: true,
        mode: 'operations',
        content: operationList,
      };
      callback && callback(result);
      return;
    });
    
    // 服务器错误
    socket.on('server-error', (params) => {
      this.ioHelper.broadcastMessage(params);
    });
    
    // 断开连接
    socket.on('disconnect', async () => {
      const { docUuid } = socket;
      // 获取用户信息，离开房间
      const usersManager = UsersManager.getInstance();
      const user = usersManager.getUser(docUuid, socket.id);
      if (user) {
        this.ioHelper.sendLeaveRoomMessage(socket, docUuid, user.username);
      }
      
      // 从服务器中删除用户。如果当前没有用户，那么保存文档到 seahub
      // delete current user from memory
      const usersCount = usersManager.deleteUser(docUuid, socket.id);
      const documentManager = DocumentManager.getInstance();
      user && documentManager.deleteCursor(docUuid, user);
      if (usersCount === 0) {
        const savedBySocket = true;
        await documentManager.saveDoc(docUuid, savedBySocket);
      }
    });
    
  }

}

export default IOServer;
