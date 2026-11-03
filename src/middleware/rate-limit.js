import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from '../config/config';

const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error_code: 'rate_limit_exceeded' },
});

export default rateLimiter;
