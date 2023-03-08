import express from 'express';
import route from './route';
import bodyParser from 'body-parser';

const app = express();

app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
app.use(bodyParser.json());

app.use(route);

app.use((err, req, res, next) => {
  res.status(500).send(err.message);
})

export default app;
