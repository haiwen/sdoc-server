import express from 'express';
import jwt from 'jsonwebtoken';
import { SEADOC_PRIVATE_KEY } from '../../config/config';
import ExcalidrawManager from './managers/excalidraw-manager';

const router = express.Router();
const base = '/api/internal/v1/shared-exdraw/:file_uuid';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const authorizeSharedRead = operation => (req, res, next) => {
  try {
    if (!SEADOC_PRIVATE_KEY) throw new Error('Signing key is not configured');
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) throw new Error('Invalid authorization');
    const payload = jwt.verify(authorization.slice(7), SEADOC_PRIVATE_KEY, {
      algorithms: ['HS256'], issuer: 'seahub', audience: 'sdoc-server-shared-exdraw', maxAge: '60s',
    });
    if (payload.purpose !== 'shared-exdraw-read' || payload.permission !== 'r' ||
        payload.operation !== operation || !uuidPattern.test(req.params.file_uuid) ||
        payload.file_uuid !== req.params.file_uuid || !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp) || payload.exp <= payload.iat || payload.exp - payload.iat > 60 ||
        payload.iat > Math.floor(Date.now() / 1000) ||
        typeof payload.filename !== 'string' || !payload.filename) {
      throw new Error('Invalid scope');
    }
    req.sharedExdraw = payload;
    next();
  } catch (error) {
    res.status(403).json({ error_code: 'permission_denied' });
  }
};

const loadScene = payload => ExcalidrawManager.getInstance().getSceneDoc(
  payload.file_uuid, payload.filename, payload.shared_by);

router.get(`${base}/scene/`, authorizeSharedRead('read_scene'), async (req, res) => {
  try {
    const scene = await loadScene(req.sharedExdraw);
    res.set('Cache-Control', 'private, no-store').json(scene);
  } catch (error) {
    res.status(502).json({ error_code: 'upstream_unavailable' });
  }
});

// Never let unsupported methods fall through to the legacy JWT routes.
router.all(`${base}/*`, (req, res) => res.status(405).json({ error_code: 'method_not_allowed' }));

export default router;
