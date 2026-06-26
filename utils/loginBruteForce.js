const { Op } = require('sequelize');
const appConfig = require('../config/app');
const { LoginAttempt, SecuritySetting, BlockedIp } = require('../models');
const { resolveRequestIpAsync } = require('./loginSessionHelper');

const SETTING_KEYS = [
  'login_attempt_limiter',
  'login_max_account_attempts',
  'login_lockout_minutes',
  'login_max_ip_attempts',
  'login_ip_window_minutes',
  'login_auto_block_ip_attempts'
];

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function getBruteForceSettings() {
  if (cachedSettings && Date.now() < cacheExpiresAt) {
    return cachedSettings;
  }

  const rows = await SecuritySetting.findAll({ where: { key: SETTING_KEYS } });
  const map = Object.fromEntries(rows.map((row) => [row.key, row]));

  cachedSettings = {
    enabled: map.login_attempt_limiter?.enabled ?? appConfig.loginBruteForce.enabled,
    maxAccountAttempts: parsePositiveInt(
      map.login_max_account_attempts?.value,
      appConfig.loginBruteForce.maxAccountAttempts
    ),
    lockoutMinutes: parsePositiveInt(
      map.login_lockout_minutes?.value,
      appConfig.loginBruteForce.lockoutMinutes
    ),
    maxIpAttempts: parsePositiveInt(
      map.login_max_ip_attempts?.value,
      appConfig.loginBruteForce.maxIpAttempts
    ),
    ipWindowMinutes: parsePositiveInt(
      map.login_ip_window_minutes?.value,
      appConfig.loginBruteForce.ipWindowMinutes
    ),
    autoBlockIpAttempts: parsePositiveInt(
      map.login_auto_block_ip_attempts?.value,
      appConfig.loginBruteForce.autoBlockIpAttempts
    )
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedSettings;
}

function clearSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

async function countRecentFailedAttempts(ip, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return LoginAttempt.count({
    where: {
      ip_address: ip,
      success: false,
      created_at: { [Op.gte]: since }
    }
  });
}

async function resolveLoginIp(req) {
  return req.clientIp || resolveRequestIpAsync(req);
}

async function isIpTemporarilyBlocked(req) {
  const settings = await getBruteForceSettings();
  if (!settings.enabled) {
    return { blocked: false };
  }

  const ip = await resolveLoginIp(req);
  const failedCount = await countRecentFailedAttempts(ip, settings.ipWindowMinutes);
  if (failedCount >= settings.maxIpAttempts) {
    return {
      blocked: true,
      reason: 'ip_rate_limit',
      failedCount,
      retryAfterMinutes: settings.ipWindowMinutes
    };
  }

  return { blocked: false, failedCount };
}

function accountLockUntil(failedCount, lockoutMinutes, maxAttempts) {
  if (failedCount >= maxAttempts) {
    return new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }
  return null;
}

async function maybeAutoBlockIp(req) {
  const settings = await getBruteForceSettings();
  if (!settings.enabled) {
    return false;
  }

  const ip = await resolveLoginIp(req);
  const failedCount = await countRecentFailedAttempts(ip, settings.ipWindowMinutes);
  if (failedCount < settings.autoBlockIpAttempts) {
    return false;
  }

  const reason = 'Automatic block: repeated failed login attempts';
  const [row] = await BlockedIp.findOrCreate({
    where: { ip_address: ip },
    defaults: { reason, active: true, blocked_by: null }
  });
  if (!row.active) {
    await row.update({ active: true, reason });
  }
  return true;
}

module.exports = {
  getBruteForceSettings,
  clearSettingsCache,
  countRecentFailedAttempts,
  isIpTemporarilyBlocked,
  accountLockUntil,
  maybeAutoBlockIp
};
