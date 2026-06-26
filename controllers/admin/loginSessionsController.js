const appConfig = require('../../config/app');
const { createActivityLog } = require('../../utils/activityLogHelper');
const adminLoginPath = require('../../utils/adminLoginPath');
const {
  listActiveAdminSessions,
  countActiveAdminSessions,
  listLoginAttempts,
  countHoneypotTraps,
  getAdminSession,
  revokeAdminSession,
  resolveRequestIpAsync
} = require('../../utils/loginSessionHelper');
const { getPagination } = require('../../utils/pagination');

async function index(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 25, 100);
    const status = ['success', 'failed', 'honeypot', 'all'].includes(req.query.status) ? req.query.status : 'all';
    const email = String(req.query.email || '').trim();

    const [sessions, sessionTotal, attempts, honeypotTraps30d, honeypotConfig] = await Promise.all([
      listActiveAdminSessions({
        limit: 100,
        offset: 0,
        currentSessionId: req.sessionID || ''
      }),
      countActiveAdminSessions(),
      listLoginAttempts({ page, limit, status, email }),
      countHoneypotTraps({ days: 30 }),
      adminLoginPath.getConfig()
    ]);

    return res.render('admin/settings/login-sessions', {
      title: 'Login & Sessions',
      sessions,
      sessionTotal,
      attempts: attempts.rows,
      meta: attempts.meta,
      filters: { status, email },
      sessionTimeoutMinutes: appConfig.adminSessionTimeoutMinutes,
      honeypotTraps30d,
      honeypotConfig
    });
  } catch (error) {
    return next(error);
  }
}

async function revoke(req, res, next) {
  try {
    const sessionId = String(req.body.session_id || '').trim();
    if (!sessionId) {
      req.flash('error', 'Session ID is required.');
      return res.redirect('/admin/settings/login-sessions');
    }

    const target = await getAdminSession(sessionId);
    if (!target) {
      req.flash('error', 'Session not found or already expired.');
      return res.redirect('/admin/settings/login-sessions');
    }

    const isCurrent = sessionId === req.sessionID;
    const revoked = await revokeAdminSession(sessionId);
    if (!revoked) {
      req.flash('error', 'Could not revoke session.');
      return res.redirect('/admin/settings/login-sessions');
    }

    await createActivityLog({
      user_id: req.session.user.id,
      action: 'revoke_session',
      resource_type: 'session',
      ip_address: await resolveRequestIpAsync(req),
      user_agent: req.get('user-agent'),
      metadata: {
        targetEmail: target.email,
        targetSessionId: sessionId.slice(0, 8)
      }
    });

    if (isCurrent) {
      const loginUrl = await adminLoginPath.getLoginUrl();
      return req.session.destroy(() => {
        res.clearCookie(appConfig.sessionName);
        req.flash('success', 'Your session was revoked. Please log in again.');
        res.redirect(loginUrl);
      });
    }
    req.flash('success', `Session for ${target.email} was revoked.`);
    return res.redirect('/admin/settings/login-sessions');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, revoke };
