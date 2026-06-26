const appConfig = require('../config/app');
const { User, Role, Permission } = require('../models');
const policy = require('../utils/policy');
const { resolveRequestIpAsync, isLoopbackIp } = require('../utils/loginSessionHelper');
const adminLoginPath = require('../utils/adminLoginPath');

async function refreshSessionUser(req) {
  const user = await User.findByPk(req.session.user.id, {
    include: [{ model: Role, include: [Permission] }]
  });
  if (!user || user.status !== 'active') return null;
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.Role?.slug,
    roleName: user.Role?.name,
    permissions: user.Role?.Permissions?.map((permission) => permission.slug) || [],
    forcePasswordChange: user.force_password_change
  };
  return req.session.user;
}

async function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect(await adminLoginPath.getLoginUrl());
  }

  const lastActivity = req.session.lastActivity || Date.now();
  const timeoutMs = appConfig.adminSessionTimeoutMinutes * 60 * 1000;
  if (Date.now() - lastActivity > timeoutMs) {
    req.session.destroy(() => {});
    req.flash('error', 'Your session expired. Please log in again.');
    return res.redirect(await adminLoginPath.getLoginUrl());
  }

  try {
    if (!req.session.lastUserRefresh || Date.now() - req.session.lastUserRefresh > 60 * 1000) {
      const refreshed = await refreshSessionUser(req);
      if (!refreshed) {
        req.session.destroy(() => {});
        return res.redirect(await adminLoginPath.getLoginUrl());
      }
      req.session.lastUserRefresh = Date.now();
    }

    if (req.session.user.forcePasswordChange && !req.path.startsWith('/profile') && req.path !== '/logout') {
      req.flash('error', 'Please update your password before continuing.');
      return res.redirect('/admin/profile');
    }

    if (!policy.canAccessAdmin(req.session.user, req.path)) {
      req.flash('error', 'Your account does not have access to the admin area.');
      return res.redirect(req.session.user.role === 'subscriber' ? '/' : '/admin/profile');
    }

    const clientIp = req.clientIp || await resolveRequestIpAsync(req);
    req.session.lastActivity = Date.now();
    req.session.lastActivityIp = clientIp;
    if (isLoopbackIp(req.session.loginIp) && !isLoopbackIp(clientIp)) {
      req.session.loginIp = clientIp;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect('/admin');
  return next();
}

module.exports = { requireAuth, guestOnly };
