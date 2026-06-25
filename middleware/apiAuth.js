const appConfig = require('../config/app');

function configuredApiKey() {
  return process.env.API_KEY || appConfig.apiKey || '';
}

function apiAuth(req, res, next) {
  const apiKey = configuredApiKey();
  if (!apiKey) return next();
  const provided = req.get('x-api-key') || req.query.api_key;
  if (provided && provided === apiKey) {
    req.apiUser = { auth: 'api_key' };
    return next();
  }
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'A valid API key is required. Send it via the X-API-Key header or api_key query parameter.'
  });
}

module.exports = { apiAuth, configuredApiKey };
