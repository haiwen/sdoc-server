import express from 'express';
import { BASE_URL_VERSION1 } from './constants';
import exdrawController from './controllers/exdraw-controller';
import formdata from '../../middleware/formdata';

const router = express.Router();

router.get(`${BASE_URL_VERSION1}/:doc_uuid/`, exdrawController.loadSceneContent);
router.post(`${BASE_URL_VERSION1}/:doc_uuid/`, formdata.single('doc_content'), exdrawController.saveSceneContent);


export default router;
