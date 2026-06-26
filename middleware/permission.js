const policy = require('../utils/policy');
const adminLoginPath = require('../utils/adminLoginPath');

function can(permission) {
  return async (req, res, next) => {
    if (policy.can(req.session.user, permission)) {
      return next();
    }
    req.flash('error', 'You do not have permission to access that section.');
    const loginUrl = await adminLoginPath.getLoginUrl();
    return res.redirect(req.session.user ? '/admin/profile' : loginUrl);
  };
}

function canAny(permissions) {
  return async (req, res, next) => {
    if (policy.hasAnyPermission(req.session.user, permissions)) return next();
    req.flash('error', 'You do not have permission to access that section.');
    const loginUrl = await adminLoginPath.getLoginUrl();
    return res.redirect(req.session.user ? '/admin/profile' : loginUrl);
  };
}

function canResource(resource, action) {
  return async (req, res, next) => {
    if (policy.canManageResource(req.session.user, resource, action)) return next();
    req.flash('error', 'You do not have permission to perform that action.');
    const loginUrl = await adminLoginPath.getLoginUrl();
    return res.redirect(req.session.user ? '/admin/profile' : loginUrl);
  };
}

module.exports = { can, canAny, canResource, policy };
