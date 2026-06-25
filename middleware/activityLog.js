const { ActivityLog } = require('../models');

const SENSITIVE_BODY_KEYS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'confirm_password',
  'token',
  '_csrf',
  'api_key',
  'secret'
]);

function sanitizeMetadata(body = {}) {
  if (!body || typeof body !== 'object') return {};
  return Object.entries(body).reduce((acc, [key, value]) => {
    if (SENSITIVE_BODY_KEYS.has(String(key).toLowerCase())) {
      acc[key] = '[FILTERED]';
      return acc;
    }
    if (typeof value === 'string') acc[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean') acc[key] = value;
    return acc;
  }, {});
}

function inferAction(req) {
  const url = req.originalUrl || req.path;
  if (/\/import/i.test(url)) return 'import';
  if (/\/export/i.test(url)) return 'export';
  if (/\/media/i.test(url)) return 'media_mutation';
  if (/\/plugins/i.test(url)) return 'plugin_mutation';
  if (/\/themes/i.test(url)) return 'theme_mutation';
  if (/\/waf/i.test(url)) return 'waf_mutation';
  if (/\/security/i.test(url)) return 'security_mutation';
  if (/\/users/i.test(url)) return 'user_mutation';
  if (/\/posts/i.test(url)) return 'post_mutation';
  if (/\/pages/i.test(url)) return 'page_mutation';
  return `${req.method.toLowerCase()}_request`;
}

function activityLogMiddleware(moduleName = 'admin') {
  return async (req, res, next) => {
    const skip = /\/settings\/database\/restore/i.test(req.originalUrl);
    if (skip) return next();

    res.on('finish', async () => {
      if (!req.session?.user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
      try {
        await ActivityLog.create({
          user_id: req.session.user.id,
          action: inferAction(req),
          entity_type: moduleName,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          metadata: {
            statusCode: res.statusCode,
            method: req.method,
            path: req.originalUrl,
            body: sanitizeMetadata(req.body)
          }
        });
      } catch (error) {
        console.error('Activity log failed:', error.message);
      }
    });
    next();
  };
}

module.exports = { activityLogMiddleware, sanitizeMetadata, inferAction };
