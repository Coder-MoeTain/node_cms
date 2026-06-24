const crypto = require('crypto');
const path = require('path');

const sensitiveKeys = new Set(['password', 'confirm_password', 'token', 'csrf', '_csrf', 'session', 'cookie', 'authorization', 'secret']);
const richTextKeys = new Set(['content', 'excerpt', 'description']);
const staticExtensions = new Set([
  '.css', '.js', '.mjs', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.pdf'
]);

function getClientIp(req) {
  const trustedProxy = req.app?.get('trust proxy');
  if (trustedProxy && req.ip) return req.ip;
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
  return socketIp.replace(/^::ffff:/, '');
}

function maskSensitiveFields(data, parentKey = '') {
  if (data === null || typeof data === 'undefined') return data;
  if (Array.isArray(data)) return data.map((item) => maskSensitiveFields(item, parentKey));
  if (typeof data !== 'object') return data;

  return Object.entries(data).reduce((payload, [key, value]) => {
    const normalizedKey = String(key).toLowerCase();
    const shouldMask = sensitiveKeys.has(normalizedKey) || sensitiveKeys.has(parentKey.toLowerCase()) || [...sensitiveKeys].some((sensitive) => normalizedKey.includes(sensitive));
    payload[key] = shouldMask ? '[FILTERED]' : maskSensitiveFields(value, normalizedKey);
    return payload;
  }, {});
}

function sanitizeLogData(data) {
  const masked = maskSensitiveFields(data);
  const serialized = JSON.stringify(masked, (key, value) => {
    if (Buffer.isBuffer(value)) return '[BUFFER]';
    if (typeof value === 'string') return value.slice(0, 4000);
    return value;
  });
  return JSON.parse(serialized || '{}');
}

function normalizeInput(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string') {
    try {
      return decodeURIComponent(value.replace(/\+/g, ' ')).toLowerCase();
    } catch (error) {
      return value.toLowerCase();
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map(normalizeInput).join(' ');
  if (typeof value === 'object') return Object.values(value).map(normalizeInput).join(' ');
  return String(value).toLowerCase();
}

function getSeverityWeight(severity) {
  return {
    low: 5,
    medium: 15,
    high: 30,
    critical: 50
  }[severity] || 10;
}

function calculateRiskScore(matches) {
  const total = matches.reduce((sum, match) => sum + Number(match.rule.score || getSeverityWeight(match.rule.severity)), 0);
  return Math.min(total, 100);
}

function safeRegex(pattern) {
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    return null;
  }
}

function matchRule(value, rule) {
  const regex = safeRegex(rule.pattern);
  if (!regex) return false;
  return regex.test(normalizeInput(value));
}

function isAdminRoute(req) {
  return req.path === '/admin' || req.path.startsWith('/admin/');
}

function isStaticAsset(req) {
  const requestPath = req.path || '';
  if (requestPath.startsWith('/css/') || requestPath.startsWith('/js/') || requestPath.startsWith('/images/') || requestPath.startsWith('/vendor/') || requestPath.startsWith('/uploads/') || requestPath.startsWith('/themes/')) {
    return true;
  }
  return staticExtensions.has(path.extname(requestPath).toLowerCase());
}

function shouldSkipWaf(req) {
  if (isStaticAsset(req)) return true;
  if (req.path === '/favicon.ico' || req.path === '/robots.txt' || req.path === '/sitemap.xml') return true;
  return false;
}

function createRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

function flattenInputs(data, options = {}, prefix = '') {
  if (data === null || typeof data === 'undefined') return [];
  if (typeof data !== 'object') return [{ key: prefix, value: data }];
  if (Array.isArray(data)) {
    return data.flatMap((item, index) => flattenInputs(item, options, `${prefix}[${index}]`));
  }
  return Object.entries(data).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (options.skipRichText && richTextKeys.has(String(key).toLowerCase())) return [];
    return flattenInputs(value, options, fullKey);
  });
}

module.exports = {
  getClientIp,
  sanitizeLogData,
  maskSensitiveFields,
  normalizeInput,
  calculateRiskScore,
  matchRule,
  isAdminRoute,
  isStaticAsset,
  shouldSkipWaf,
  createRequestId,
  safeRegex,
  getSeverityWeight,
  flattenInputs
};
