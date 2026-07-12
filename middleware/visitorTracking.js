const { recordVisitorPageView, shouldTrackVisit } = require('../utils/visitorStatsHelper');

function visitorTrackingMiddleware(req, res, next) {
  if (!shouldTrackVisit(req)) return next();

  recordVisitorPageView(req).catch((error) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Visitor tracking failed:', error.message);
    }
  });

  return next();
}

module.exports = { visitorTrackingMiddleware };
