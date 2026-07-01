const EventEmitter = require('events');
const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');

const trafficBus = new EventEmitter();
trafficBus.setMaxListeners(100);

const BOT_UA = /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|preview|headless|bingpreview|yandex|baidu|duckduck/i;

function shouldTrackPublicTraffic(req) {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/admin') || req.path.startsWith('/api') || req.path.startsWith('/health')) return false;
  if (req.path.startsWith('/vendor/') || req.path.startsWith('/uploads/') || req.path.startsWith('/themes/')) return false;
  if (/\.(css|js|map|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|xml|txt|json)$/i.test(req.path)) return false;
  return true;
}

function parseUserAgent(ua = '') {
  const s = String(ua);
  const isBot = BOT_UA.test(s);
  let deviceType = 'unknown';
  if (isBot) deviceType = 'bot';
  else if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(s)) deviceType = 'mobile';
  else if (/ipad|tablet|playbook|silk/i.test(s)) deviceType = 'tablet';
  else if (s) deviceType = 'desktop';

  let browser = 'Unknown';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/chrome/i.test(s) && !/edg/i.test(s)) browser = 'Chrome';
  else if (/firefox/i.test(s)) browser = 'Firefox';
  else if (/safari/i.test(s) && !/chrome/i.test(s)) browser = 'Safari';
  else if (/msie|trident/i.test(s)) browser = 'IE';

  let os = 'Unknown';
  if (/windows/i.test(s)) os = 'Windows';
  else if (/mac os|macintosh/i.test(s)) os = 'macOS';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/linux/i.test(s)) os = 'Linux';

  return { deviceType, browser, os, isBot };
}

function isMissingTrafficLogsError(error) {
  const message = String(error?.message || '');
  const code = error?.parent?.code || error?.original?.code;
  return code === 'ER_NO_SUCH_TABLE' || /traffic_logs.*doesn't exist/i.test(message);
}

function buildRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function buildWhereClause(filters = {}) {
  const where = {};
  if (filters.site_id) where.site_id = filters.site_id;
  if (filters.ip) where.ip_address = { [Op.like]: `%${filters.ip}%` };
  if (filters.path) where.path = { [Op.like]: `%${filters.path}%` };
  if (filters.device) where.device_type = filters.device;
  if (filters.status) where.response_status = Number(filters.status);
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    where.created_at = { [Op.between]: [start, end] };
  }
  return where;
}

function serializeTrafficLog(row) {
  const plain = row?.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    site_id: plain.site_id,
    request_id: plain.request_id,
    ip_address: plain.ip_address,
    method: plain.method,
    path: plain.path,
    url: plain.url,
    referer: plain.referer,
    user_agent: plain.user_agent,
    response_status: plain.response_status,
    response_ms: plain.response_ms,
    device_type: plain.device_type,
    browser: plain.browser,
    os: plain.os,
    is_bot: plain.is_bot,
    created_at: plain.created_at
  };
}

function emitTrafficHit(entry) {
  trafficBus.emit('hit', entry);
}

function subscribeTrafficHits(listener) {
  trafficBus.on('hit', listener);
  return () => trafficBus.off('hit', listener);
}

async function recordTrafficHit(payload) {
  const { TrafficLog } = require('../models');
  const ua = parseUserAgent(payload.user_agent);
  const data = {
    site_id: payload.site_id ?? null,
    request_id: payload.request_id || buildRequestId(),
    ip_address: payload.ip_address || '0.0.0.0',
    method: payload.method || 'GET',
    path: (payload.path || '/').slice(0, 512),
    url: payload.url || payload.path || '/',
    referer: payload.referer || null,
    user_agent: payload.user_agent || null,
    response_status: payload.response_status ?? 200,
    response_ms: payload.response_ms ?? null,
    device_type: ua.deviceType,
    browser: ua.browser,
    os: ua.os,
    is_bot: ua.isBot
  };

  try {
    const row = await TrafficLog.create(data);
    const entry = serializeTrafficLog(row);
    emitTrafficHit(entry);
    return entry;
  } catch (error) {
    if (isMissingTrafficLogsError(error)) return null;
    throw error;
  }
}

async function getTrafficStats(siteId = null) {
  const { TrafficLog } = require('../models');
  const today = startOfToday();
  const lastHour = minutesAgo(60);
  const activeWindow = minutesAgo(5);
  const baseWhere = siteId ? { site_id: siteId } : {};

  try {
    const [hitsToday, hitsLastHour, uniqueIpsToday, activeNow, avgResponseMs] = await Promise.all([
      TrafficLog.count({ where: { ...baseWhere, created_at: { [Op.gte]: today } } }),
      TrafficLog.count({ where: { ...baseWhere, created_at: { [Op.gte]: lastHour } } }),
      TrafficLog.count({
        where: { ...baseWhere, created_at: { [Op.gte]: today } },
        distinct: true,
        col: 'ip_address'
      }),
      TrafficLog.count({ where: { ...baseWhere, created_at: { [Op.gte]: activeWindow } } }),
      TrafficLog.findOne({
        attributes: [[fn('AVG', col('response_ms')), 'avgMs']],
        where: { ...baseWhere, created_at: { [Op.gte]: today }, response_ms: { [Op.ne]: null } },
        raw: true
      })
    ]);

    return {
      hitsToday,
      hitsLastHour,
      uniqueIpsToday,
      activeNow,
      avgResponseMs: Math.round(Number(avgResponseMs?.avgMs || 0))
    };
  } catch (error) {
    if (isMissingTrafficLogsError(error)) {
      return { hitsToday: 0, hitsLastHour: 0, uniqueIpsToday: 0, activeNow: 0, avgResponseMs: 0 };
    }
    throw error;
  }
}

async function listTrafficLogs({ filters = {}, page = 1, limit = 50 } = {}) {
  const { TrafficLog } = require('../models');
  const where = buildWhereClause(filters);
  const offset = (page - 1) * limit;

  try {
    const { rows, count } = await TrafficLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    return { rows, count };
  } catch (error) {
    if (isMissingTrafficLogsError(error)) return { rows: [], count: 0 };
    throw error;
  }
}

async function deleteOldTrafficLogs(days = 30) {
  const { TrafficLog } = require('../models');
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    return await TrafficLog.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
  } catch (error) {
    if (isMissingTrafficLogsError(error)) return 0;
    throw error;
  }
}

function escapeCsv(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function buildTrafficCsv(filters = {}) {
  const { rows } = await listTrafficLogs({ filters, page: 1, limit: 10000 });
  const header = ['id', 'created_at', 'ip_address', 'method', 'path', 'url', 'response_status', 'response_ms', 'device_type', 'browser', 'os', 'referer', 'user_agent'];
  const lines = [header.join(',')];
  rows.forEach((row) => {
    const plain = serializeTrafficLog(row);
    lines.push(header.map((key) => escapeCsv(plain[key])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

module.exports = {
  shouldTrackPublicTraffic,
  parseUserAgent,
  recordTrafficHit,
  subscribeTrafficHits,
  getTrafficStats,
  listTrafficLogs,
  deleteOldTrafficLogs,
  buildTrafficCsv,
  serializeTrafficLog
};
