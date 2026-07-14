const crypto = require('crypto');
const { Op, fn, col, literal } = require('sequelize');
const { VisitorPageView, sequelize } = require('../models');
const { getCurrentSiteId } = require('./siteScope');
const { formatInTimezone } = require('./timezoneHelper');

const ALLOWED_RANGES = [7, 14, 30, 90];
const DEFAULT_RANGE = 7;
const DEFAULT_RETENTION_DAYS = 90;

function shouldTrackVisit(req) {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/admin') || req.path.startsWith('/api') || req.path.startsWith('/health')) return false;
  if (req.path.startsWith('/vendor/') || req.path.startsWith('/uploads/') || req.path.startsWith('/themes/')) return false;
  if (/\.(css|js|map|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|xml|txt)$/i.test(req.path)) return false;
  const ua = String(req.get('user-agent') || '');
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview|headless|wget|curl/i.test(ua)) return false;
  return true;
}

function isTrackingEnabled(siteSettings = {}) {
  return siteSettings.visitor_tracking_enabled !== 'false';
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || '')).digest('hex').slice(0, 64);
}

function hashSession(req) {
  const sid = req.sessionID || req.session?.id || '';
  const ip = req.clientIp || '';
  return crypto.createHash('sha256').update(`${sid}:${ip}`).digest('hex').slice(0, 64);
}

function normalizeReferrer(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 512);
  } catch {
    return raw.slice(0, 512);
  }
}

function parseRangeDays(value) {
  const days = Number.parseInt(String(value || DEFAULT_RANGE), 10);
  return ALLOWED_RANGES.includes(days) ? days : DEFAULT_RANGE;
}

function siteFilter(siteId) {
  if (!siteId) return {};
  return { site_id: siteId };
}

function rangeWhere(siteId, days) {
  return {
    ...siteFilter(siteId),
    viewed_at: { [Op.gte]: literal(`DATE_SUB(NOW(), INTERVAL ${Number(days)} DAY)`) }
  };
}

async function recordVisitorPageView(req) {
  if (!shouldTrackVisit(req)) return false;
  const siteSettings = req.res?.locals?.siteSettings || {};
  if (!isTrackingEnabled(siteSettings)) return false;

  const path = String(req.path || '/').slice(0, 512);
  const userAgent = String(req.get('user-agent') || '').slice(0, 512);
  const referrer = normalizeReferrer(req.get('referer') || req.get('referrer'));
  const siteId = getCurrentSiteId(req);

  await VisitorPageView.create({
    site_id: siteId || null,
    path,
    referrer,
    user_agent: userAgent,
    session_hash: hashSession(req),
    ip_hash: hashIp(req.clientIp),
    viewed_at: new Date()
  });
  return true;
}

async function countPageViews(siteId, days) {
  return VisitorPageView.count({ where: rangeWhere(siteId, days) });
}

async function countUniqueVisitors(siteId, days) {
  const where = rangeWhere(siteId, days);
  const row = await VisitorPageView.findOne({
    attributes: [[fn('COUNT', fn('DISTINCT', col('session_hash'))), 'total']],
    where: { ...where, session_hash: { [Op.ne]: null } },
    raw: true
  });
  return Number(row?.total || 0);
}

async function countTodayViews(siteId) {
  const where = {
    ...siteFilter(siteId),
    viewed_at: { [Op.gte]: literal('CURDATE()') }
  };
  return VisitorPageView.count({ where });
}

async function countTodayUniqueVisitors(siteId) {
  const row = await VisitorPageView.findOne({
    attributes: [[fn('COUNT', fn('DISTINCT', col('session_hash'))), 'total']],
    where: {
      ...siteFilter(siteId),
      session_hash: { [Op.ne]: null },
      viewed_at: { [Op.gte]: literal('CURDATE()') }
    },
    raw: true
  });
  return Number(row?.total || 0);
}

function buildChartDays(dayRows, timeZone, days) {
  const countsByDate = new Map(
    (dayRows || []).map((row) => {
      const day = row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10);
      return [day, Number(row.count || 0)];
    })
  );
  const chartDays = [];
  const now = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - offset);
    const isoKey = start.toISOString().slice(0, 10);
    const count = countsByDate.get(isoKey) || 0;
    chartDays.push({
      label: formatInTimezone(start, timeZone, { locale: 'en-US', month: 'short', day: 'numeric' }),
      weekday: formatInTimezone(start, timeZone, { locale: 'en-US', weekday: 'short' }),
      count
    });
  }
  const max = Math.max(...chartDays.map((day) => day.count), 1);
  return chartDays.map((day) => ({ ...day, height: Math.max(8, Math.round((day.count / max) * 100)) }));
}

async function getViewsByDay(siteId, days, timeZone) {
  const rows = await VisitorPageView.findAll({
    attributes: [
      [fn('DATE', col('viewed_at')), 'day'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: rangeWhere(siteId, days),
    group: [fn('DATE', col('viewed_at'))],
    order: [[fn('DATE', col('viewed_at')), 'ASC']],
    raw: true
  });
  return buildChartDays(rows, timeZone, days);
}

async function getTopPages(siteId, days, limit = 10) {
  return VisitorPageView.findAll({
    attributes: ['path', [fn('COUNT', col('id')), 'count']],
    where: rangeWhere(siteId, days),
    group: ['path'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit,
    raw: true
  });
}

async function getTopReferrers(siteId, days, limit = 10) {
  return VisitorPageView.findAll({
    attributes: ['referrer', [fn('COUNT', col('id')), 'count']],
    where: {
      ...rangeWhere(siteId, days),
      referrer: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    },
    group: ['referrer'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit,
    raw: true
  });
}

function classifyBrowser(userAgent = '') {
  const ua = String(userAgent);
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  return 'Other';
}

async function getBrowserBreakdown(siteId, days, limit = 6) {
  const rows = await VisitorPageView.findAll({
    attributes: ['user_agent', [fn('COUNT', col('id')), 'count']],
    where: rangeWhere(siteId, days),
    group: ['user_agent'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 50,
    raw: true
  });
  const totals = new Map();
  for (const row of rows) {
    const label = classifyBrowser(row.user_agent);
    totals.set(label, (totals.get(label) || 0) + Number(row.count || 0));
  }
  return [...totals.entries()]
    .map(([browser, count]) => ({ browser, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getRecentViews(siteId, limit = 15) {
  return VisitorPageView.findAll({
    where: siteFilter(siteId),
    order: [['viewed_at', 'DESC']],
    limit,
    attributes: ['id', 'path', 'referrer', 'user_agent', 'viewed_at']
  });
}

async function purgeOldRecords(retentionDays = DEFAULT_RETENTION_DAYS) {
  const days = Math.max(7, Number.parseInt(String(retentionDays), 10) || DEFAULT_RETENTION_DAYS);
  const deleted = await VisitorPageView.destroy({
    where: {
      viewed_at: { [Op.lt]: literal(`DATE_SUB(NOW(), INTERVAL ${days} DAY)`) }
    }
  });
  return deleted;
}

async function getDashboardStats(req, options = {}) {
  const siteId = getCurrentSiteId(req);
  const days = parseRangeDays(options.days);
  const timeZone = options.timeZone || 'UTC';
  const [
    totalViews,
    uniqueVisitors,
    viewsToday,
    uniqueToday,
    viewsByDay,
    topPages,
    topReferrers,
    browserBreakdown,
    recentViews
  ] = await Promise.all([
    countPageViews(siteId, days),
    countUniqueVisitors(siteId, days),
    countTodayViews(siteId),
    countTodayUniqueVisitors(siteId),
    getViewsByDay(siteId, days, timeZone),
    getTopPages(siteId, days),
    getTopReferrers(siteId, days),
    getBrowserBreakdown(siteId, days),
    getRecentViews(siteId)
  ]);

  return {
    days,
    totalViews,
    uniqueVisitors,
    viewsToday,
    uniqueToday,
    viewsByDay,
    topPages,
    topReferrers,
    browserBreakdown,
    recentViews,
    avgViewsPerDay: days ? Math.round(totalViews / days) : 0
  };
}

async function exportViewsCsv(siteId, days) {
  const rows = await VisitorPageView.findAll({
    where: rangeWhere(siteId, days),
    order: [['viewed_at', 'DESC']],
    limit: 5000,
    attributes: ['path', 'referrer', 'user_agent', 'viewed_at'],
    raw: true
  });
  const header = 'viewed_at,path,referrer,user_agent\n';
  const body = rows.map((row) => {
    const escape = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
    return [escape(row.viewed_at), escape(row.path), escape(row.referrer), escape(row.user_agent)].join(',');
  }).join('\n');
  return `${header}${body}\n`;
}

async function tableReady() {
  try {
    await sequelize.query('SELECT 1 FROM visitor_page_views LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ALLOWED_RANGES,
  DEFAULT_RANGE,
  DEFAULT_RETENTION_DAYS,
  shouldTrackVisit,
  isTrackingEnabled,
  parseRangeDays,
  recordVisitorPageView,
  countPageViews,
  countUniqueVisitors,
  getDashboardStats,
  exportViewsCsv,
  purgeOldRecords,
  tableReady,
  classifyBrowser
};
