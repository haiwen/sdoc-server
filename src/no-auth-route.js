import express from 'express';

const noAuthRouter = express.Router();

noAuthRouter.get('/', (req, res) => {
    res.send('Welcome to sdoc-server. Please create a new sdoc file in seafile and hope you enjoy using it.');
});

noAuthRouter.get('/ping', (req, res) => {
    res.send('pong');
});

export default noAuthRouter;
