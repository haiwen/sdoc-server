import express from 'express';
import noAuthRouter from './no-auth-route';
import bodyParser from 'body-parser';
import cors from './middleware/cors';
import auth from './middleware/auth';
import responseTimeMiddleware from './middleware/response-time';
import route from './modules/sdoc/route';
import exdrawRoute from './modules/exdraw/route';
import { BASE_URL_VERSION1, ELEMENT_COMMAND_LIMITS } from './modules/sdoc/constants';

const app = express();

const elementCommandPath = `${BASE_URL_VERSION1}/:doc_uuid/element-commands`;
app.use(elementCommandPath, bodyParser.json({ limit: ELEMENT_COMMAND_LIMITS.MAX_REQUEST_BYTES }));
// eslint-disable-next-line
app.use(elementCommandPath, (err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    res.status(413).send({
      error_code: 'batch_limit_exceeded',
      command_index: null,
      document_version: null,
    });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).send({
      error_code: 'invalid_request',
      command_index: null,
    });
    return;
  }
  next(err);
});
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.all("*", cors); // Access-Control-Allow-Origin
app.use(responseTimeMiddleware);
app.use(noAuthRouter);
app.use(auth);
app.use(route);
app.use(exdrawRoute);

// eslint-disable-next-line
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
  return;
});

export default app;
