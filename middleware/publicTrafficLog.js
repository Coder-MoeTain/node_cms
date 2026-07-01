const { shouldTrackPublicTraffic, recordTrafficHit } = require('../utils/trafficLogHelper');

function publicTrafficLogMiddleware(req, res, next) {
  if (!shouldTrackPublicTraffic(req)) return next();

  const startedAt = Date.now();
  res.on('finish', () => {
    recordTrafficHit({
      site_id: res.locals.currentSite?.id || req.currentSite?.id || null,
      ip_address: req.clientIp || req.ip || '',
      method: req.method,
      path: req.path,
      url: req.originalUrl || req.url,
      referer: req.get('referer') || null,
      user_agent: req.get('user-agent') || null,
      response_status: res.statusCode,
      response_ms: Date.now() - startedAt
    }).catch(() => {});
  });

  return next();
}

module.exports = { publicTrafficLogMiddleware };
