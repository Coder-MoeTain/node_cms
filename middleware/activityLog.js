const { ActivityLog } = require('../models');

function activityLogMiddleware(moduleName = 'admin') {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (!req.session?.user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
      try {
        await ActivityLog.create({
          user_id: req.session.user.id,
          action: `${req.method} ${req.originalUrl}`,
          entity_type: moduleName,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          metadata: { statusCode: res.statusCode }
        });
      } catch (error) {
        console.error('Activity log failed:', error.message);
      }
    });
    next();
  };
}

module.exports = { activityLogMiddleware };
