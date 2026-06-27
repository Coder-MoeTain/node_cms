const appConfig = require('../config/app');
const { verifyJwt, normalizeScopes } = require('../utils/jwtToken');

function configuredApiKey() {
  return process.env.API_KEY || appConfig.apiKey || '';
}

function extractApiKey(req) {
  const headerKey = req.get('x-api-key');
  if (headerKey) return headerKey.trim();

  const authorization = req.get('authorization') || '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();

  return null;
}

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '[FILTERED]';
  if (key.length <= 8) return '[FILTERED]';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function apiAuth(req, res, next) {
  const apiKey = configuredApiKey();
  if (!apiKey) return next();

  if (req.query?.api_key) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API keys in query strings are not allowed. Use the X-API-Key header or Authorization: Bearer token.'
    });
  }

  const provided = extractApiKey(req);
  if (provided && provided === apiKey) {
    req.apiUser = { auth: 'api_key', scopes: normalizeScopes('admin') };
    return next();
  }

  if (provided) {
    const payload = verifyJwt(provided);
    if (payload) {
      req.apiUser = {
        auth: 'jwt',
        sub: payload.sub || null,
        scopes: normalizeScopes(payload.scopes || payload.scope || 'read')
      };
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'A valid API key or JWT is required. Send via X-API-Key or Authorization: Bearer <token>.'
  });
}

module.exports = {
  apiAuth,
  configuredApiKey,
  extractApiKey,
  maskApiKey
};
