const rateLimit = require('express-rate-limit');

const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { rateLimitMiddleware };
