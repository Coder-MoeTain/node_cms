const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { BlockedIp } = require('../models');
const appConfig = require('../config/app');

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

const publicMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many submissions. Try again later.'
});

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://translate.google.com', 'https://translate.googleapis.com'],
          "style-src": ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
          "font-src": ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com', 'data:'],
          "img-src": ["'self'", 'data:', 'https:'],
          "frame-src": ["'self'", 'https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com'],
          "connect-src": ["'self'"]
        }
      }
    })
  );
  app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));
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

module.exports = { applySecurityMiddleware, loginLimiter, publicMutationLimiter };
