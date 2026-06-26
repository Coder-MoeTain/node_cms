const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { LoginAttempt, WafSetting } = require('../models');
const { getClientIp, isLoopbackIp } = require('./wafHelper');

const TRUSTED_PROXY_CACHE_MS = 60 * 1000;
let trustedProxyCache = { value: false, at: 0 };

async function loadTrustedProxyEnabled() {
  const now = Date.now();
  if (trustedProxyCache.at && now - trustedProxyCache.at < TRUSTED_PROXY_CACHE_MS) {
    return trustedProxyCache.value;
  }
  try {
    const row = await WafSetting.findOne({ where: { setting_key: 'trusted_proxy_enabled' } });
    const value = row?.setting_value === 'true' || row?.setting_value === true;
    trustedProxyCache = { value, at: now };
    return value;
  } catch {
    return false;
  }
}

function isTrustProxyRequest(req, trustedProxyEnabled = false) {
  const { shouldTrustForwardedHeaders } = require('./wafHelper');
  return shouldTrustForwardedHeaders(req, trustedProxyEnabled);
}

function resolveRequestIp(req, trustedProxyEnabled = false) {
  return getClientIp(req, trustedProxyEnabled);
}

async function resolveRequestIpAsync(req) {
  if (req.clientIp) return req.clientIp;
  const trustedProxyEnabled = await loadTrustedProxyEnabled();
  return resolveRequestIp(req, trustedProxyEnabled);
}

function invalidateTrustedProxyCache() {
  trustedProxyCache = { value: false, at: 0 };
}

function parseSessionData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function parseExpires(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 1e12) return new Date(asNumber);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSessionRow(row, currentSessionId = '') {
  const data = parseSessionData(row.data);
  const user = data.user;
  if (!user?.email) return null;

  const sid = String(row.sid || row.session_id || '');
  const expiresAt = parseExpires(row.expires);
  const loginAt = data.loginAt ? new Date(data.loginAt) : null;
  const lastActivity = data.lastActivity ? new Date(data.lastActivity) : loginAt;

  return {
    sessionId: sid,
    sessionIdShort: sid ? `${sid.slice(0, 8)}…` : '—',
    username: user.name || user.email,
    email: user.email,
    role: user.role || user.roleName || '—',
    ipAddress: data.lastActivityIp || data.loginIp || '—',
    loginAt,
    lastActivity,
    expiresAt,
    isCurrent: Boolean(currentSessionId && sid === currentSessionId)
  };
}

async function getAdminSession(sessionId) {
  if (!sessionId) return null;
  try {
    const [rows] = await sequelize.query(
      'SELECT sid, expires, data FROM sessions WHERE sid = ? LIMIT 1',
      { replacements: [String(sessionId)] }
    );
    if (!rows.length) return null;
    return parseSessionRow(rows[0]);
  } catch {
    return null;
  }
}

async function revokeAdminSession(sessionId) {
  if (!sessionId) return false;
  try {
    const [, metadata] = await sequelize.query(
      'DELETE FROM sessions WHERE sid = ?',
      { replacements: [String(sessionId)] }
    );
    const affected = metadata?.affectedRows ?? metadata;
    return Number(affected) > 0;
  } catch {
    return false;
  }
}

async function listActiveAdminSessions({ limit = 50, offset = 0, currentSessionId = '' } = {}) {
  try {
    const [rows] = await sequelize.query(
      'SELECT sid, expires, data FROM sessions WHERE expires > UTC_TIMESTAMP() ORDER BY expires DESC LIMIT ? OFFSET ?',
      { replacements: [limit, offset] }
    );
    return rows
      .map((row) => parseSessionRow(row, currentSessionId))
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = left.lastActivity || left.loginAt || 0;
        const rightTime = right.lastActivity || right.loginAt || 0;
        return new Date(rightTime) - new Date(leftTime);
      });
  } catch {
    return [];
  }
}

async function countActiveAdminSessions() {
  try {
    const [rows] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM sessions WHERE expires > UTC_TIMESTAMP()'
    );
    return Number(rows?.[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function listLoginAttempts({
  page = 1,
  limit = 25,
  status = 'all',
  email = ''
} = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  const where = {};

  if (status === 'success') where.success = true;
  if (status === 'failed') where.success = false;
  if (status === 'honeypot') {
    where.success = false;
    where.reason = 'honeypot_trap';
  }

  const trimmedEmail = String(email || '').trim();
  if (trimmedEmail) {
    where.email = { [Op.like]: `%${trimmedEmail}%` };
  }

  const { rows, count } = await LoginAttempt.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset
  });

  return {
    rows: rows.map((row) => {
      const isHoneypot = row.reason === 'honeypot_trap';
      return {
        id: row.id,
        username: row.email || '—',
        email: row.email,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        success: Boolean(row.success),
        reason: row.reason,
        isHoneypot,
        remark: isHoneypot
          ? 'Honeypot trap — decoy login at /admin/login (IP auto-blocked)'
          : formatLoginAttemptRemark(row.reason, row.user_agent),
        createdAt: row.created_at
      };
    }),
    meta: {
      total: count,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(Math.ceil(count / safeLimit), 1)
    }
  };
}

function formatLoginAttemptRemark(reason, userAgent) {
  const labels = {
    success: 'Successful login',
    invalid_credentials: 'Invalid email or password',
    honeypot_trap: 'Honeypot trap — decoy login at /admin/login (IP auto-blocked)'
  };
  if (labels[reason]) return labels[reason];
  if (reason) return reason.replace(/_/g, ' ');
  return userAgent || '—';
}

async function countHoneypotTraps({ days = 30 } = {}) {
  try {
    const since = new Date(Date.now() - Math.max(Number(days) || 30, 1) * 24 * 60 * 60 * 1000);
    return await LoginAttempt.count({
      where: {
        reason: 'honeypot_trap',
        created_at: { [Op.gte]: since }
      }
    });
  } catch {
    return 0;
  }
}

module.exports = {
  resolveRequestIp,
  resolveRequestIpAsync,
  invalidateTrustedProxyCache,
  isLoopbackIp,
  listActiveAdminSessions,
  countActiveAdminSessions,
  listLoginAttempts,
  countHoneypotTraps,
  getAdminSession,
  revokeAdminSession,
  parseSessionRow
};
