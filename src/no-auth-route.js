import express from 'express';

const noAuthRouter = express.Router();

noAuthRouter.get('/', (req, res) => {
    const version = process.env.server_version || 'dev'; 
    res.send(`Welcome to sdoc-server. The current version is ${version}`);
});

noAuthRouter.get('/ping', (req, res) => {
    res.send('pong');
});

export default noAuthRouter;
