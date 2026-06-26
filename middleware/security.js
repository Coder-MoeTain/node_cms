const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { BlockedIp } = require('../models');
const appConfig = require('../config/app');
const adminLoginPath = require('../utils/adminLoginPath');

const loginLimiter = rateLimit({
  windowMs: (appConfig.loginBruteForce.rateLimitWindowMinutes || 15) * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : appConfig.loginBruteForce.rateLimitMax || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Try again later.',
  handler(req, res) {
    if (req.flash) {
      req.flash('error', 'Too many login attempts. Try again later.');
      return res.redirect(adminLoginPath.getLoginUrlForRequestSync(req));
    }
    return res.status(429).send('Too many login attempts. Try again later.');
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many API requests. Try again later.'
});

const publicMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many submissions. Try again later.'
});

function createCspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

function parseCspSourceList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function appendCloudflareInsightsCsp(directives) {
  // Cloudflare injects Web Analytics at the edge; allow unless explicitly disabled.
  if (process.env.CSP_CLOUDFLARE_INSIGHTS === 'false') return;
  directives.scriptSrc.push('https://static.cloudflareinsights.com');
  directives.connectSrc.push('https://cloudflareinsights.com');
}

function buildCspDirectives(req, res) {
  const nonce = res.locals.cspNonce ? `'nonce-${res.locals.cspNonce}'` : null;
  const isAdmin = req.path === '/admin' || req.path.startsWith('/admin/');

  const scriptSrc = ["'self'", 'https://cdn.jsdelivr.net', ...parseCspSourceList(process.env.CSP_SCRIPT_SRC_EXTRA)];
  if (isAdmin) {
    scriptSrc.push("'unsafe-inline'");
  } else if (nonce) {
    scriptSrc.push(nonce);
  }

  const styleSrc = ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', ...parseCspSourceList(process.env.CSP_STYLE_SRC_EXTRA)];
  if (isAdmin) {
    styleSrc.push("'unsafe-inline'");
  } else if (nonce) {
    styleSrc.push(nonce);
  }

  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc,
    fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    frameSrc: ["'self'", 'https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com'],
    connectSrc: ["'self'", ...parseCspSourceList(process.env.CSP_CONNECT_SRC_EXTRA)],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"]
  };

  appendCloudflareInsightsCsp(directives);

  // Bootstrap carousel applies transform/transition via element.style (style attributes).
  if (!isAdmin) {
    directives.styleSrcAttr = ["'unsafe-inline'"];
  }

  return directives;
}

function applySecurityMiddleware(app) {
  app.use(createCspNonce);
  app.use((req, res, next) => {
    helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: buildCspDirectives(req, res)
    })(req, res, next);
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: appConfig.env === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false
    })
  );
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });
  app.use(cors({ origin: appConfig.corsOrigin, credentials: true }));
  app.use(async (req, res, next) => {
    try {
      const { resolveRequestIpAsync } = require('../utils/loginSessionHelper');
      const ip = await resolveRequestIpAsync(req);
      const blocked = await BlockedIp.findOne({ where: { ip_address: ip, active: true } });
      if (blocked) return res.status(403).send('Your IP address is blocked.');
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = {
  applySecurityMiddleware,
  loginLimiter,
  apiLimiter,
  publicMutationLimiter,
  buildCspDirectives,
  createCspNonce
};
