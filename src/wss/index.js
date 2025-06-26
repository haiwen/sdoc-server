import auth from "./auth";
import IOHandler from "../modules/sdoc/wio/io-handler";
import ExdrawHandler from "../modules/exdraw/wio/io-handler";
import { EXDRAW_NAMESPACE } from "../modules/exdraw/constants";

class IOServer {

  constructor(io) {
    this.io = io;
    const ioHandler = IOHandler.getInstance(io);
    const exdrawHandler = ExdrawHandler.getInstance(io);
    io.on('connection', (socket) => { ioHandler.onConnection(socket); });
    io.use(auth);
    io.of(EXDRAW_NAMESPACE).on('connection', (socket) => { exdrawHandler.onConnection(socket); });
    io.of(EXDRAW_NAMESPACE).use(auth);
  }

}

export default IOServer;
