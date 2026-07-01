const {
  getTrafficStats,
  listTrafficLogs,
  deleteOldTrafficLogs,
  buildTrafficCsv,
  subscribeTrafficHits
} = require('../../utils/trafficLogHelper');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { createActivityLog } = require('../../utils/activityLogHelper');

const deviceTypes = ['desktop', 'mobile', 'tablet', 'bot', 'unknown'];

async function index(req, res) {
  const { page, limit } = getPagination(req, 50, 100);
  const filters = {
    ip: req.query.ip,
    path: req.query.path,
    device: req.query.device,
    status: req.query.status,
    date: req.query.date
  };
  const [stats, { rows, count }] = await Promise.all([
    getTrafficStats(),
    listTrafficLogs({ filters, page, limit })
  ]);

  return res.render('admin/traffic/index', {
    title: 'Traffic Log',
    stats,
    logs: rows,
    meta: pageMeta(count, page, limit),
    filters: req.query,
    deviceTypes
  });
}

function stream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, at: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25000);

  const unsubscribe = subscribeTrafficHits((entry) => {
    res.write(`event: hit\ndata: ${JSON.stringify(entry)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

async function exportCsv(req, res) {
  const filters = {
    ip: req.query.ip,
    path: req.query.path,
    device: req.query.device,
    status: req.query.status,
    date: req.query.date
  };
  const csv = await buildTrafficCsv(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="traffic-logs.csv"');
  return res.send(csv);
}

async function deleteOld(req, res) {
  const days = Math.max(1, Number(req.body.days) || 30);
  const deleted = await deleteOldTrafficLogs(days);
  await createActivityLog({
    user_id: req.session.user.id,
    action: 'traffic_logs_purge',
    resource_type: 'traffic_log',
    ip_address: req.clientIp,
    metadata: { days, deleted }
  });
  req.flash('success', `Deleted ${deleted} traffic log record(s) older than ${days} day(s).`);
  return res.redirect('/admin/traffic');
}

module.exports = { index, stream, exportCsv, deleteOld };
