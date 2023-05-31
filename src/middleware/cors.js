// 允许跨域
export default (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTIONS");
  // options 请求直接返回 200
  // 为什么在 POST 请求前，需要发送一个 options 请求？options 请求的作用
  // 1、获取服务器支持的 HTTP 方法 
  // 2、判断服务器的性能（AJAX进行跨域请求时的预检，需要向另外一个域名的资源发送一个HTTP OPTIONS请求头，用以判断实际发送的请求是否安全）
  // https://cloud.tencent.com/developer/article/1046663
  if (req.method.toLowerCase() == 'options') {
    res.sendStatus(200);
  } else {
    next();
  }
};
