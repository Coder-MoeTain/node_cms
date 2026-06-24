const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { BlockedIp } = require('../models');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(cors({ origin: true, credentials: true }));
  app.use(apiLimiter);
  app.use(async (req, res, next) => {
    try {
      const blocked = await BlockedIp.findOne({ where: { ip_address: req.ip, active: true } });
      if (blocked) return res.status(403).send('Your IP address is blocked.');
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = { applySecurityMiddleware, loginLimiter };
