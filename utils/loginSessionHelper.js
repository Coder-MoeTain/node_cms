const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { LoginAttempt } = require('../models');
const { getClientIp } = require('./wafHelper');

function resolveRequestIp(req) {
  const trustProxy = Boolean(req.app?.get('trust proxy'));
  return getClientIp(req, trustProxy);
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
    ipAddress: data.loginIp || '—',
    loginAt,
    lastActivity,
    expiresAt,
    isCurrent: Boolean(currentSessionId && sid === currentSessionId)
  };
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
    rows: rows.map((row) => ({
      id: row.id,
      username: row.email || '—',
      email: row.email,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      success: Boolean(row.success),
      reason: row.reason,
      createdAt: row.created_at
    })),
    meta: {
      total: count,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(Math.ceil(count / safeLimit), 1)
    }
  };
}

module.exports = {
  resolveRequestIp,
  listActiveAdminSessions,
  countActiveAdminSessions,
  listLoginAttempts,
  parseSessionRow
};
