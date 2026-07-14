const { SiteSetting } = require('../../models');
const { Op } = require('sequelize');
const { createActivityLog } = require('../../utils/activityLogHelper');
const { getCurrentSiteId } = require('../../utils/siteScope');
const {
  ALLOWED_RANGES,
  DEFAULT_RETENTION_DAYS,
  parseRangeDays,
  getDashboardStats,
  exportViewsCsv,
  purgeOldRecords,
  tableReady,
  isTrackingEnabled
} = require('../../utils/visitorStatsHelper');

async function loadTrackingSettings(req) {
  const siteId = getCurrentSiteId(req);
  const scope = siteId
    ? { [Op.or]: [{ site_id: null }, { site_id: siteId }] }
    : { site_id: null };
  const rows = await SiteSetting.findAll({
    where: {
      ...scope,
      key: { [Op.in]: ['visitor_tracking_enabled', 'visitor_retention_days'] }
    }
  });
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  if (settings.visitor_tracking_enabled == null) settings.visitor_tracking_enabled = 'true';
  if (settings.visitor_retention_days == null) settings.visitor_retention_days = String(DEFAULT_RETENTION_DAYS);
  return settings;
}

async function upsertTrackingSetting(req, key, value) {
  const siteId = getCurrentSiteId(req);
  await SiteSetting.upsert({
    key,
    value: String(value),
    group: 'analytics',
    site_id: siteId || null
  });
}

async function index(req, res, next) {
  try {
    const days = parseRangeDays(req.query.days);
    const trackingSettings = await loadTrackingSettings(req);
    const ready = await tableReady();
    const stats = ready
      ? await getDashboardStats(req, { days, timeZone: res.locals.siteTimezone })
      : {
        days,
        totalViews: 0,
        uniqueVisitors: 0,
        viewsToday: 0,
        uniqueToday: 0,
        viewsByDay: [],
        topPages: [],
        topReferrers: [],
        browserBreakdown: [],
        recentViews: [],
        avgViewsPerDay: 0
      };

    return res.render('admin/visitor-stats/index', {
      title: 'Visitor Statistics',
      activeNav: 'dashboard',
      stats,
      trackingSettings,
      ready,
      trackingEnabled: isTrackingEnabled(trackingSettings),
      allowedRanges: ALLOWED_RANGES,
      selectedDays: days
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const enabled = req.body.visitor_tracking_enabled === 'on' || req.body.visitor_tracking_enabled === 'true';
    const retention = Math.max(7, Math.min(365, Number.parseInt(String(req.body.visitor_retention_days || DEFAULT_RETENTION_DAYS), 10) || DEFAULT_RETENTION_DAYS));

    await upsertTrackingSetting(req, 'visitor_tracking_enabled', enabled ? 'true' : 'false');
    await upsertTrackingSetting(req, 'visitor_retention_days', retention);

    if (req.body.purge_old === 'on') {
      const deleted = await purgeOldRecords(retention);
      await createActivityLog({
        user_id: req.session?.user?.id || null,
        action: 'visitor_stats_purge',
        entity_type: 'visitor_stats',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        metadata: { deleted, retention_days: retention }
      });
      req.flash('success', `Removed ${deleted} page view record(s) older than ${retention} days.`);
    } else {
      await createActivityLog({
        user_id: req.session?.user?.id || null,
        action: 'visitor_stats_settings_update',
        entity_type: 'visitor_stats',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        metadata: { enabled, retention_days: retention }
      });
      req.flash('success', 'Visitor tracking settings saved.');
    }

    return res.redirect('/admin/visitor-stats');
  } catch (error) {
    return next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const days = parseRangeDays(req.query.days);
    const siteId = getCurrentSiteId(req);
    const csv = await exportViewsCsv(siteId, days);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="visitor-stats-${days}d.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, updateSettings, exportCsv };
