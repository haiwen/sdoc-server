# 第三方库和常用脚本

## 常用脚本

```
"clean": "rm -rf dist", 清空编译文件

"test": "node ./scripts/test.js", 单元测试

"lint": "eslint \"**/*.js\"" 代码格式检查

"start": "export SDOC_SERVER_CONFIG=config/config.json && nodemon --exec babel-node ./src/_bin/www.js", 开发环境下

"build": "npm run clean && ./node_modules/.bin/babel src --out-dir dist", 把ES6代码编译成ES5代码
 
"serve": "node --max-old-space-size=4096 ./dist/_bin/www.js", 生产环境下，运行 ES5 代码，开启服务器

```

## 第三方库

```
"@babel/plugin-proposal-export-default-from": "^7.18.10", 默认导出模块

"@seafile/slate": "0.91.11", slate 工具函数中执行 OP

"body-parser": "^1.20.2", 中间件，用于解析 post 请求 body

"connect-multiparty": "^2.2.0", 中间件，用于上传文件

"jsonwebtoken": "9.0.0", JWT 用于登录认证

"socket.io": "4.6.1", 用于建立 socket 连接

其他常见第三方库

"axios": "^1.3.4",

"express": "^4.18.2",

"form-data": "^4.0.0",

"log4js": "^6.9.0",

"mysql": "^2.17.1",

"uuid": "9.0.0"

开发需要的第三方库（babel 编译）

"@babel/cli": "^7.21.0",
"@babel/core": "^7.21.0",
"@babel/eslint-parser": "^7.19.1",
"@babel/node": "^7.20.7",
"@babel/preset-env": "^7.20.2",
"babel-jest": "29.5.0",
"eslint": "^8.35.0",
"eslint-plugin-import": "^2.27.5",
"jest": "29.5.0",
"nodemon": "^2.0.21"
```

