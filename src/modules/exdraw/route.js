import express from 'express';
import { BASE_URL_VERSION1 } from './constants';
import exdrawController from './controllers/exdraw-controller';

const router = express.Router();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, exdrawController.loadDocContent);


export default router;
