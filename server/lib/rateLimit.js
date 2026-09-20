// Rate limit for AI routes: 20 requests/minute per IP. Health is NOT limited.

import rateLimit from 'express-rate-limit';

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message:
        'Too many AI requests from this board — wait a minute and try again, or type the concept instead.',
      canTypeInstead: true,
    },
  },
});
