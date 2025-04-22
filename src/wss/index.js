import auth from "./auth";
import IOHandler from "../modules/sdoc/wio/io-handler";

class IOServer {

  constructor(io) {
    this.io = io;
    const ioHandler = IOHandler.getInstance(io);
    io.on('connection', (socket) => { ioHandler.onConnection(socket); });
    io.use(auth);
  }

}

export default IOServer;
