const appConfig = require('../config/app');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/admin/login');
  }

  const lastActivity = req.session.lastActivity || Date.now();
  const timeoutMs = appConfig.adminSessionTimeoutMinutes * 60 * 1000;
  if (Date.now() - lastActivity > timeoutMs) {
    req.session.destroy(() => {});
    return res.redirect('/admin/login');
  }

  req.session.lastActivity = Date.now();
  return next();
}

function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect('/admin');
  return next();
}

module.exports = { requireAuth, guestOnly };
