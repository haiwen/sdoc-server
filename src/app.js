import express from 'express';
import noAuthRouter from './no-auth-route';
import bodyParser from 'body-parser';
import cors from './middleware/cors';
import auth from './middleware/auth';
import responseTimeMiddleware from './middleware/response-time';
import route from './modules/sdoc/route';
import exdrawRoute from './modules/exdraw/route';

const app = express();

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
