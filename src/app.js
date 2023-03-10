import express from 'express';
import route from './route';
import bodyParser from 'body-parser';
import cors from './middleware/cors';

const app = express();

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));

app.all("*", cors); // Access-Control-Allow-Origin
app.use(route);

app.use((err, req, res, next) => {
  res.status(500).send(err.message);
})

export default app;
