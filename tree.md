# 项目架构

## 2023-05-30 架构

./src
├── _bin
│   └── www 启动脚本（初始化 express 服务器，创建 web-socket 服务，文件自动保存服务，监听事件并写入日志）

├── api
│   └── sea-server-api 请求 seahub 的API，获取 token，获取上传下载链接，上传下载文件

├── app 全局 express 实例入口文件，处理POST请求格式，跨域，登录验证，路由，错误返回

├── dao 数据库操作
│   └── operation-log 将操作日志写入数据库，获取当前 doc 悬挂的 operations
├── db-helper 数据库工具函数（数据库配置，创建连接池，执行查询，断开连接）

├── loggers
│   └── index 日志打印工具函数（设置日志路径，日志级别）

├── middleware 中间件
│   ├── auth 登录验证 jwtToken
│   ├── cors 跨域

├── config 配置文件（数据库配置，服务器地址，端口号等）

├── constants 常量：服务器的基本 API 配置，最大缓存的操作数量

├── utils
│   ├── index 工具函数（文件目录操作，时间转换，解析 URL）
│   └── slate-utils 批量执行操作并更新最后修改人

├── route 服务端路由组件（文件内容和协作人的路由）

用户管理
├── controllers ——不同路由执行的操作（具体操作在 managers 中实现）核心逻辑
│   └── user-controller 客户端请求用户，返回当前 doc 中的协作人
├── managers
│   └── users-manager 用户管理组件

文件管理（核心）
├── controllers ——不同路由执行的操作（具体操作在 managers 中实现）核心逻辑
│   ├── document-controller GET 和 POST 分别对应文档获取和保存
├── managers
│   ├── document-manager（文档对象管理器，全部文档的保存，更新，获取，新建）
├── models
│   └── document 一个文档对象（包括自身属性和基本操作）

操作管理（核心）
├── managers
│   ├── operations-manager 操作管理（操作管理器对象存储1000条近期记录，其他的操作写入数据库，然后支持获取服务器和客户端的差距的操作-丢失获取）

web-socket 服务（核心）
└── wss
    ├── auth ws-jwt 登录认证
    ├── index web-socket 服务器主程序（用户进入房间，用户离开房间，更新文档，同步文档，断开连接，服务器错误处理等）
    └── io-helper ws-工具函数（离开进入房间，广播错误信息等）
