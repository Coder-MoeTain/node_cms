const { Op } = require('sequelize');
const crypto = require('crypto');
const { SecuritySetting, BlockedIp, WafIpList, LoginAttempt } = require('../models');
const { resolveRequestIpAsync } = require('./loginSessionHelper');
const { createActivityLog } = require('./activityLogHelper');

const SECRET_SLUG_PATTERN = /^np-auth-[a-z0-9]{6,48}$/i;
const CACHE_TTL_MS = 60_000;

let cachedConfig = null;
let cacheExpiresAt = 0;

function generateSecretSlug() {
  return `np-auth-${crypto.randomBytes(6).toString('hex')}`;
}

function isValidSecretSlug(slug) {
  return SECRET_SLUG_PATTERN.test(String(slug || '').trim());
}

function normalizeSecretSlug(slug) {
  const trimmed = String(slug || '').trim().toLowerCase();
  return isValidSecretSlug(trimmed) ? trimmed : '';
}

async function loadConfig({ fresh = false } = {}) {
  if (!fresh && cachedConfig && Date.now() < cacheExpiresAt) {
    return cachedConfig;
  }

  const rows = await SecuritySetting.findAll({
    where: {
      key: { [Op.in]: ['admin_login_honeypot_enabled', 'admin_login_secret_slug'] }
    }
  });
  const map = Object.fromEntries(rows.map((row) => [row.key, row]));
  const honeypotRow = map.admin_login_honeypot_enabled;
  const honeypotEnabled = honeypotRow?.enabled === true
    || honeypotRow?.value === 'true'
    || honeypotRow?.value === true;
  let secretSlug = normalizeSecretSlug(map.admin_login_secret_slug?.value);

  if (honeypotEnabled && !secretSlug) {
    secretSlug = generateSecretSlug();
    await SecuritySetting.upsert({
      key: 'admin_login_secret_slug',
      value: secretSlug,
      enabled: true
    });
  }

  const loginUrl = honeypotEnabled ? `/admin/${secretSlug}` : '/admin/login';
  cachedConfig = {
    honeypotEnabled,
    honeypotPath: '/admin/login',
    secretSlug,
    loginUrl,
    secretUrl: honeypotEnabled ? loginUrl : '/admin/login'
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedConfig;
}

function clearConfigCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

async function getConfig(options) {
  return loadConfig(options);
}

async function isHoneypotActive() {
  const config = await loadConfig({ fresh: true });
  return Boolean(config.honeypotEnabled);
}

async function getLoginUrl(query = '') {
  const config = await loadConfig();
  const suffix = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  return `${config.loginUrl}${suffix}`;
}

function getLoginUrlSync() {
  return cachedConfig?.loginUrl || '/admin/login';
}

function routerPathFromRequest(req) {
  return req.path || '';
}

function isHoneypotRouterPath(req) {
  const path = routerPathFromRequest(req);
  return path === '/login' || path === '/login/';
}

async function isSecretRouterPath(req) {
  const config = await loadConfig();
  if (!config.honeypotEnabled) return false;
  const path = routerPathFromRequest(req).replace(/^\//, '').replace(/\/$/, '');
  return path === config.secretSlug;
}

async function blockHoneypotAttacker(req, email = '') {
  const ip = await resolveRequestIpAsync(req);
  const reason = 'Honeypot admin login trap';

  const [row] = await BlockedIp.findOrCreate({
    where: { ip_address: ip },
    defaults: { reason, active: true, blocked_by: null }
  });
  if (!row.active) {
    await row.update({ active: true, reason });
  }

  try {
    const { clearWafCache } = require('../middleware/waf');
    await WafIpList.findOrCreate({
      where: { ip_address: ip, list_type: 'blacklist' },
      defaults: { reason, status: true, expires_at: null }
    });
    clearWafCache();
  } catch {
    // WAF tables may be unavailable during early bootstrap
  }

  await LoginAttempt.create({
    email: String(email || '').trim() || 'honeypot@trap.local',
    ip_address: ip,
    user_agent: req.get('user-agent') || '',
    success: false,
    reason: 'honeypot_trap'
  });

  await createActivityLog({
    action: 'honeypot_trap',
    resource_type: 'security',
    ip_address: ip,
    user_agent: req.get('user-agent'),
    metadata: { email: email || null, path: req.originalUrl }
  });

  return ip;
}

async function dispatchLoginForm(req, res, next) {
  try {
    const config = await loadConfig({ fresh: true });
    const auth = require('../controllers/admin/authController');
    if (config.honeypotEnabled) {
      return auth.honeypotLoginForm(req, res);
    }
    return auth.loginForm(req, res);
  } catch (error) {
    return next(error);
  }
}

async function dispatchLoginPost(req, res, next) {
  try {
    const config = await loadConfig({ fresh: true });
    const auth = require('../controllers/admin/authController');
    if (config.honeypotEnabled) {
      return auth.honeypotLogin(req, res, next);
    }
    return auth.login(req, res, next);
  } catch (error) {
    return next(error);
  }
}

async function secretLoginForm(req, res, next) {
  try {
    const config = await loadConfig();
    if (!config.honeypotEnabled) return next();
    const path = routerPathFromRequest(req).replace(/^\//, '').replace(/\/$/, '');
    if (path !== config.secretSlug) {
      return res.status(404).render('errors/404', { title: 'Not Found' });
    }
    const auth = require('../controllers/admin/authController');
    return auth.loginForm(req, res);
  } catch (error) {
    return next(error);
  }
}

async function secretLoginPost(req, res, next) {
  try {
    const config = await loadConfig();
    if (!config.honeypotEnabled) return next();
    const path = routerPathFromRequest(req).replace(/^\//, '').replace(/\/$/, '');
    if (path !== config.secretSlug) {
      return res.status(404).render('errors/404', { title: 'Not Found' });
    }
    const auth = require('../controllers/admin/authController');
    return auth.login(req, res, next);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  SECRET_SLUG_PATTERN,
  generateSecretSlug,
  isValidSecretSlug,
  normalizeSecretSlug,
  getConfig,
  isHoneypotActive,
  getLoginUrl,
  getLoginUrlSync,
  clearConfigCache,
  isHoneypotRouterPath,
  isSecretRouterPath,
  blockHoneypotAttacker,
  dispatchLoginForm,
  dispatchLoginPost,
  secretLoginForm,
  secretLoginPost
};
