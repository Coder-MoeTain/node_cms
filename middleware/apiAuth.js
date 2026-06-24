const appConfig = require('../config/app');

function apiAuth(req, res, next) {
  if (!appConfig.apiKey) return next();
  const provided = req.get('x-api-key') || req.query.api_key;
  if (provided && provided === appConfig.apiKey) return next();
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'A valid API key is required. Send it via the X-API-Key header or api_key query parameter.'
  });
}

module.exports = { apiAuth };
