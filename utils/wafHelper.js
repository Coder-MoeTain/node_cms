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

function normalizeIp(ip) {
  return String(ip || '').replace(/^::ffff:/, '').trim();
}

function isPrivateOrLoopbackIp(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') {
    return true;
  }
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  return false;
}

function isLoopbackIp(ip) {
  const normalized = normalizeIp(ip);
  return !normalized || normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function hasForwardedClientHeader(req) {
  return Boolean(
    req.headers['cf-connecting-ip']
    || req.headers['true-client-ip']
    || req.headers['x-real-ip']
    || req.headers['x-forwarded-for']
  );
}

function isTrustedProxyRequest(req, trustedProxyEnabled = false) {
  if (trustedProxyEnabled) return true;
  const trustProxySetting = req.app?.get('trust proxy');
  return Boolean(trustProxySetting);
}

function shouldTrustForwardedHeaders(req, trustedProxyEnabled = false) {
  if (trustedProxyEnabled) return true;
  if (req.wafTrustProxy) return true;
  if (isTrustedProxyRequest(req, false)) return true;
  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return isPrivateOrLoopbackIp(socketIp) && hasForwardedClientHeader(req);
}

function getClientIp(req, trustedProxyEnabled = false) {
  const trustProxy = shouldTrustForwardedHeaders(req, trustedProxyEnabled);
  const normalize = normalizeIp;

  if (trustProxy) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp) return normalize(cfIp);

    const trueClientIp = req.headers['true-client-ip'];
    if (trueClientIp) return normalize(trueClientIp);

    const realIp = req.headers['x-real-ip'];
    if (realIp) return normalize(realIp);

    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return normalize(String(forwarded).split(',')[0]);

    if (Array.isArray(req.ips) && req.ips.length) return normalize(req.ips[0]);
    if (req.ip) return normalize(req.ip);
  }

  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip || '';
  return normalize(socketIp);
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

const MAX_REGEX_PATTERN_LENGTH = 512;
const MAX_MATCH_INPUT_LENGTH = 8000;

function safeRegex(pattern) {
  if (!pattern || typeof pattern !== 'string') return null;
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    return null;
  }
}

function ipv4ToLong(ip) {
  const parts = String(ip || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipMatchesCidr(clientIp, cidr) {
  const [network, bitsRaw] = String(cidr || '').split('/');
  const bits = Number(bitsRaw);
  if (!network || Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const client = ipv4ToLong(clientIp);
  const networkLong = ipv4ToLong(network);
  if (client === null || networkLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (client & mask) === (networkLong & mask);
}

function ipMatchesListEntry(clientIp, listEntry) {
  const normalizedClient = String(clientIp || '').replace(/^::ffff:/, '');
  const entry = String(listEntry || '').trim();
  if (!entry) return false;
  if (entry.includes('/')) return ipMatchesCidr(normalizedClient, entry);
  return normalizedClient === entry.replace(/^::ffff:/, '');
}

function findIpListMatches(clientIp, rows = []) {
  return rows.filter((row) => row.status !== false && !isExpiredIpListItem(row) && ipMatchesListEntry(clientIp, row.ip_address));
}

function matchPattern(value, rule) {
  const raw = value === null || typeof value === 'undefined' ? '' : String(value);
  if (raw.length > MAX_MATCH_INPUT_LENGTH) return false;
  const normalized = normalizeValue(raw);
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
  const trustedProxy = req.wafTrustProxy === true;
  return {
    url: req.originalUrl || req.url || '',
    query: flattenInputs(req.query, {}, 'query'),
    body: flattenInputs(req.body, { skipRichText }, 'body'),
    headers: flattenInputs(req.headers, {}, 'headers'),
    userAgent: req.get('user-agent') || '',
    ip: getClientIp(req, trustedProxy),
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

  const blockMatches = matches.filter((match) => match.rule.action === 'block');
  const hasBlockRule = blockMatches.length > 0;
  const hasRateLimitRule = matches.some((match) => match.rule.action === 'rate_limit');
  const hasTempBlockRule = matches.some((match) => match.rule.action === 'temporary_block');

  if (settings.waf_mode !== 'block') {
    return matches.length ? 'log' : 'allow';
  }
  if (hasTempBlockRule && score >= threshold) return 'temporary_block';
  if (hasRateLimitRule && score >= Math.max(10, threshold - 15)) return 'rate_limit';
  if (hasBlockRule && score >= threshold) return 'block';
  if (hasBlockRule && blockMatches.some((match) => {
    const ruleFloor = Number(match.rule.score || getSeverityWeight(match.rule.severity));
    return score >= ruleFloor;
  })) return 'block';
  if (score >= threshold && matches.some((match) => ['block', 'rate_limit', 'temporary_block'].includes(match.rule.action))) {
    return matches[0].rule.action;
  }
  return matches.length ? 'log' : 'allow';
}

function summarizeMatchedRules(matches = []) {
  if (!matches.length) return { name: null, category: null, severity: null, ruleId: null };
  const primary = matches[0].rule;
  const names = matches.map((match) => match.rule?.name).filter(Boolean);
  const uniqueNames = [...new Set(names)];
  let matchedRuleName = uniqueNames[0] || null;
  if (uniqueNames.length > 1) {
    matchedRuleName = `${uniqueNames[0]} (+${uniqueNames.length - 1} more)`;
  }
  const severities = ['low', 'medium', 'high', 'critical'];
  const highestSeverity = matches
    .map((match) => match.rule?.severity)
    .filter(Boolean)
    .sort((left, right) => severities.indexOf(right) - severities.indexOf(left))[0] || primary?.severity || null;
  return {
    name: matchedRuleName,
    category: primary?.category || null,
    severity: highestSeverity,
    ruleId: primary?.id || null,
    all: matches.map((match) => ({
      id: match.rule?.id || null,
      name: match.rule?.name || null,
      category: match.rule?.category || null,
      severity: match.rule?.severity || null,
      target: match.target?.target || null,
      key: match.target?.key || null
    }))
  };
}

function buildSafeLogPayload(req, matches, actionTaken, riskScore) {
  const summary = summarizeMatchedRules(matches);
  const normalized = normalizeRequestData(req);
  const bodySnapshot = sanitizeLogData(req.body || {});
  if (summary.all?.length) {
    bodySnapshot._waf_meta = { matched_rules: summary.all };
  }
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
    body_snapshot: bodySnapshot,
    file_snapshot: sanitizeLogData(normalized.files),
    matched_rule_id: summary.ruleId,
    matched_rule_name: summary.name,
    category: summary.category,
    severity: summary.severity,
    action_taken: actionTaken,
    risk_score: riskScore || 0,
    is_admin_route: normalized.isAdminRoute,
    user_id: req.session?.user?.id || null,
    response_status: actionTaken === 'allow' ? null : 403
  };
}

function createWafBlockResponse(req, res, message = 'Request blocked by Web Application Firewall.') {
  const blockMessage = String(message || 'Request blocked by Web Application Firewall.').trim()
    || 'Request blocked by Web Application Firewall.';
  if (req.xhr || (req.accepts('json') && !req.accepts('html'))) {
    return res.status(403).json({
      error: 'waf_blocked',
      message: blockMessage,
      request_id: req.wafRequestId || null
    });
  }
  return res.status(403).render('errors/403', {
    title: 'Access Denied',
    layout: false,
    message: blockMessage
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
  if (String(pattern).length > MAX_REGEX_PATTERN_LENGTH) return false;
  if (patternType === 'regex') return Boolean(safeRegex(pattern));
  return true;
}

function isDangerousUploadFilename(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return dangerousUploadExtensions.includes(ext);
}

module.exports = {
  getClientIp,
  isTrustedProxyRequest,
  shouldTrustForwardedHeaders,
  isPrivateOrLoopbackIp,
  isLoopbackIp,
  hasForwardedClientHeader,
  normalizeIp,
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
  dangerousUploadExtensions,
  ipMatchesListEntry,
  ipMatchesCidr,
  findIpListMatches,
  summarizeMatchedRules,
  MAX_REGEX_PATTERN_LENGTH
};
