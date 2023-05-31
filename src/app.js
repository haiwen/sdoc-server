import express from 'express';
import route from './route';
import bodyParser from 'body-parser';
import cors from './middleware/cors';
import auth from './middleware/auth';

// 创建服务器实例
const app = express();

// 处理 POST 请求的格式，JSON格式，或者默认的 application/x-www-form-urlencoded 解析器，限制最大的数据量
// create application/json parser
app.use(bodyParser.json({ limit: '100mb' }));
// create application/x-www-form-urlencoded parser
app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));

// 中间件

// 全部请求允许跨域操作
app.all("*", cors); // Access-Control-Allow-Origin

// 鉴权操作
app.use(auth);

// 路由操作
app.use(route);

// 错误处理，500 返回错误信息
// eslint-disable-next-line
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
  return;
});

export default app;
