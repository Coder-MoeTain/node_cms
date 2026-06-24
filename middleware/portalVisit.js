const { incrementPortalVisitCount } = require('../utils/portalStats');

function shouldTrackVisit(req) {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/admin') || req.path.startsWith('/api') || req.path.startsWith('/health')) return false;
  if (req.path.startsWith('/vendor/') || req.path.startsWith('/uploads/') || req.path.startsWith('/themes/')) return false;
  if (/\.(css|js|map|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|xml|txt)$/i.test(req.path)) return false;
  return true;
}

function portalVisitMiddleware(req, res, next) {
  if (!shouldTrackVisit(req)) return next();

  const today = new Date().toISOString().slice(0, 10);
  const sessionKey = `portalVisit_${today}`;
  if (req.session?.[sessionKey]) return next();

  if (req.session) req.session[sessionKey] = true;

  incrementPortalVisitCount().catch((error) => {
    console.error('Portal visit counter failed:', error.message);
  });

  return next();
}

module.exports = { portalVisitMiddleware };
