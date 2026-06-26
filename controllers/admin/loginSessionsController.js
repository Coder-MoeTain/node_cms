const appConfig = require('../../config/app');
const {
  listActiveAdminSessions,
  countActiveAdminSessions,
  listLoginAttempts
} = require('../../utils/loginSessionHelper');
const { getPagination, pageMeta } = require('../../utils/pagination');

async function index(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 25, 100);
    const status = ['success', 'failed', 'all'].includes(req.query.status) ? req.query.status : 'all';
    const email = String(req.query.email || '').trim();

    const [sessions, sessionTotal, attempts] = await Promise.all([
      listActiveAdminSessions({
        limit: 100,
        offset: 0,
        currentSessionId: req.sessionID || ''
      }),
      countActiveAdminSessions(),
      listLoginAttempts({ page, limit, status, email })
    ]);

    return res.render('admin/settings/login-sessions', {
      title: 'Login & Sessions',
      sessions,
      sessionTotal,
      attempts: attempts.rows,
      meta: attempts.meta,
      filters: { status, email },
      sessionTimeoutMinutes: appConfig.adminSessionTimeoutMinutes
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
