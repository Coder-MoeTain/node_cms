const crypto = require('crypto');
const path = require('path');

const sensitiveKeys = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'confirmpassword',
  'confirm_password',
  'token',
  'resettoken',
  'csrf',
  '_csrf',
  'session',
  'cookie',
  'authorization',
  'secret',
  'apikey',
  'accesstoken',
  'refreshtoken'
]);

const richTextKeys = new Set(['content', 'excerpt', 'description']);

const staticExtensions = new Set([
  '.css', '.js', '.mjs', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.pdf'
]);

const dangerousUploadExtensions = ['.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.jsp', '.asp', '.aspx'];

function getClientIp(req, trustedProxyEnabled = false) {
  const trustProxy = trustedProxyEnabled || req.app?.get('trust proxy');
  if (trustProxy && req.ip) return req.ip.replace(/^::ffff:/, '');
  const forwarded = req.headers['x-forwarded-for'];
  if (trustProxy && forwarded) {
    return String(forwarded).split(',')[0].trim().replace(/^::ffff:/, '');
  }
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
  return socketIp.replace(/^::ffff:/, '');
}

function maskSensitiveFields(data, parentKey = '') {
  if (data === null || typeof data === 'undefined') return data;
  if (Array.isArray(data)) return data.map((item) => maskSensitiveFields(item, parentKey));
  if (typeof data !== 'object') return data;

  return Object.entries(data).reduce((payload, [key, value]) => {
    const normalizedKey = String(key).toLowerCase();
    const shouldMask = sensitiveKeys.has(normalizedKey)
      || sensitiveKeys.has(String(parentKey).toLowerCase())
      || [...sensitiveKeys].some((sensitive) => normalizedKey.includes(sensitive));
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
  try {
    return JSON.parse(serialized || '{}');
  } catch (error) {
    return {};
  }
}

function normalizeValue(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string') {
    try {
      return decodeURIComponent(value.replace(/\+/g, ' ')).toLowerCase();
    } catch (error) {
      return value.toLowerCase();
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map(normalizeValue).join(' ');
  if (typeof value === 'object') return Object.values(value).map(normalizeValue).join(' ');
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

function safeRegex(pattern) {
  if (!pattern || typeof pattern !== 'string') return null;
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    return null;
  }
}

function matchPattern(value, rule) {
  const normalized = normalizeValue(value);
  if (!normalized) return false;

  const patternType = rule.pattern_type || 'regex';
  const pattern = String(rule.pattern || '');

  if (patternType === 'equals') {
    return normalized === normalizeValue(pattern);
  }
  if (patternType === 'contains') {
    return normalized.includes(normalizeValue(pattern));
  }

  const regex = safeRegex(pattern);
  if (!regex) return false;
  return regex.test(normalized);
}

function matchRule(value, rule) {
  return matchPattern(value, rule);
}

function isAdminRoute(req) {
  return req.path === '/admin' || req.path.startsWith('/admin/');
}

function isStaticAsset(req) {
  const requestPath = req.path || '';
  if (
    requestPath.startsWith('/css/')
    || requestPath.startsWith('/js/')
    || requestPath.startsWith('/images/')
    || requestPath.startsWith('/vendor/')
    || requestPath.startsWith('/uploads/')
    || requestPath.startsWith('/themes/')
  ) {
    return true;
  }
  return staticExtensions.has(path.extname(requestPath).toLowerCase());
}

function shouldSkipWaf(req) {
  if (isStaticAsset(req)) return true;
  if (req.path === '/favicon.ico' || req.path === '/robots.txt' || req.path === '/sitemap.xml') return true;
  if (req.path === '/health' || req.path === '/ready') return true;
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

function extractFileMetadata(req) {
  const files = [];
  if (req.file) {
    files.push({ field: req.file.fieldname, name: req.file.originalname, mime: req.file.mimetype });
  }
  if (Array.isArray(req.files)) {
    req.files.forEach((file) => files.push({ field: file.fieldname, name: file.originalname, mime: file.mimetype }));
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).flat().forEach((file) => {
      files.push({ field: file.fieldname, name: file.originalname, mime: file.mimetype });
    });
  }
  return files;
}

function normalizeRequestData(req) {
  const skipRichText = Boolean(req.session?.user) && isAdminRoute(req);
  return {
    url: req.originalUrl || req.url || '',
    query: flattenInputs(req.query, {}, 'query'),
    body: flattenInputs(req.body, { skipRichText }, 'body'),
    headers: flattenInputs(req.headers, {}, 'headers'),
    userAgent: req.get('user-agent') || '',
    ip: getClientIp(req),
    files: extractFileMetadata(req),
    method: req.method,
    routeType: getRouteType(req),
    isAdminRoute: isAdminRoute(req)
  };
}

function matchRuleAgainstRequest(rule, normalizedRequest) {
  const targets = [];

  if (rule.target === 'all' || rule.target === 'url') {
    targets.push({ target: 'url', key: 'url', value: normalizedRequest.url });
  }
  if (rule.target === 'all' || rule.target === 'query') {
    targets.push(...normalizedRequest.query.map((entry) => ({ target: 'query', ...entry })));
  }
  if (rule.target === 'all' || rule.target === 'body') {
    targets.push(...normalizedRequest.body.map((entry) => ({ target: 'body', ...entry })));
  }
  if (rule.target === 'all' || rule.target === 'headers') {
    targets.push(...normalizedRequest.headers.map((entry) => ({ target: 'headers', ...entry })));
  }
  if (rule.target === 'all' || rule.target === 'user_agent') {
    targets.push({ target: 'user_agent', key: 'user-agent', value: normalizedRequest.userAgent });
  }
  if (rule.target === 'all' || rule.target === 'ip') {
    targets.push({ target: 'ip', key: 'ip', value: normalizedRequest.ip });
  }
  if (rule.target === 'all' || rule.target === 'file_name') {
    targets.push(...normalizedRequest.files.map((file) => ({
      target: 'file_name',
      key: file.field,
      value: file.name
    })));
  }

  for (const target of targets) {
    if (matchPattern(target.value, rule)) {
      return { rule, target };
    }
  }
  return null;
}

function calculateRiskScore(matches, isAdminRouteFlag = false) {
  const total = matches.reduce(
    (sum, match) => sum + Number(match.rule.score || getSeverityWeight(match.rule.severity)),
    0
  );
  const multiplier = isAdminRouteFlag ? 1.15 : 1;
  return Math.min(Math.round(total * multiplier), 100);
}

function getActionForRiskScore(score, settings, isAdminRouteFlag, matches = []) {
  const maxPublic = Number(settings.max_risk_score_public ?? settings.max_risk_score ?? 50);
  const maxAdmin = Number(settings.max_risk_score_admin ?? Math.max(20, maxPublic - 10));
  const threshold = isAdminRouteFlag ? maxAdmin : maxPublic;

  const hasBlockRule = matches.some((match) => match.rule.action === 'block');
  const hasRateLimitRule = matches.some((match) => match.rule.action === 'rate_limit');
  const hasTempBlockRule = matches.some((match) => match.rule.action === 'temporary_block');

  if (settings.waf_mode !== 'block') {
    return matches.length ? 'log' : 'allow';
  }
  if (hasTempBlockRule && score >= threshold) return 'temporary_block';
  if (hasRateLimitRule && score >= Math.max(10, threshold - 15)) return 'rate_limit';
  if (hasBlockRule && score >= threshold) return 'block';
  if (score >= threshold && matches.some((match) => ['block', 'rate_limit', 'temporary_block'].includes(match.rule.action))) {
    return matches[0].rule.action;
  }
  return matches.length ? 'log' : 'allow';
}

function buildSafeLogPayload(req, matches, actionTaken, riskScore) {
  const primary = matches[0];
  const normalized = normalizeRequestData(req);
  return {
    request_id: req.wafRequestId || createRequestId(),
    ip_address: normalized.ip,
    method: req.method,
    url: normalized.url,
    route_type: normalized.routeType,
    user_agent: normalized.userAgent,
    referer: req.get('referer') || null,
    headers_snapshot: sanitizeLogData(req.headers || {}),
    query_snapshot: sanitizeLogData(req.query || {}),
    body_snapshot: sanitizeLogData(req.body || {}),
    file_snapshot: sanitizeLogData(normalized.files),
    matched_rule_id: primary?.rule?.id || null,
    matched_rule_name: primary?.rule?.name || null,
    category: primary?.rule?.category || null,
    severity: primary?.rule?.severity || null,
    action_taken: actionTaken,
    risk_score: riskScore || 0,
    is_admin_route: normalized.isAdminRoute,
    user_id: req.session?.user?.id || null,
    response_status: actionTaken === 'allow' ? null : 403
  };
}

function createWafBlockResponse(req, res, message = 'Request blocked by Web Application Firewall.') {
  if (req.xhr || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return res.status(403).render('errors/403', {
    title: 'Access Denied',
    layout: false,
    message
  });
}

function isExpiredIpListItem(item) {
  if (!item || !item.expires_at) return false;
  return new Date(item.expires_at) <= new Date();
}

function getRouteType(req) {
  if (req.path === '/admin/login') return 'admin_login';
  if (isAdminRoute(req)) return 'admin';
  if (req.path.startsWith('/api/')) return 'api';
  if (req.path === '/search' || req.path === '/contact' || /\/post\/\d+\/comment$/.test(req.path)) {
    return 'public_mutation';
  }
  if (isStaticAsset(req)) return 'static';
  return 'public';
}

function validatePattern(pattern, patternType = 'regex') {
  if (!pattern || !String(pattern).trim()) return false;
  if (patternType === 'regex') return Boolean(safeRegex(pattern));
  return true;
}

function isDangerousUploadFilename(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return dangerousUploadExtensions.includes(ext);
}

module.exports = {
  getClientIp,
  sanitizeLogData,
  maskSensitiveFields,
  normalizeValue,
  normalizeInput: normalizeValue,
  normalizeRequestData,
  calculateRiskScore,
  matchRule,
  matchPattern,
  matchRuleAgainstRequest,
  isAdminRoute,
  isStaticAsset,
  shouldSkipWaf,
  createRequestId,
  safeRegex,
  getSeverityWeight,
  flattenInputs,
  getActionForRiskScore,
  buildSafeLogPayload,
  createWafBlockResponse,
  isExpiredIpListItem,
  getRouteType,
  validatePattern,
  isDangerousUploadFilename,
  dangerousUploadExtensions
};
