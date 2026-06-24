const policy = require('../utils/policy');

function can(permission) {
  return (req, res, next) => {
    if (policy.can(req.session.user, permission)) {
      return next();
    }
    req.flash('error', 'You do not have permission to access that section.');
    return res.redirect(req.session.user ? '/admin/profile' : '/admin/login');
  };
}

function canAny(permissions) {
  return (req, res, next) => {
    if (policy.hasAnyPermission(req.session.user, permissions)) return next();
    req.flash('error', 'You do not have permission to access that section.');
    return res.redirect(req.session.user ? '/admin/profile' : '/admin/login');
  };
}

function canResource(resource, action) {
  return (req, res, next) => {
    if (policy.canManageResource(req.session.user, resource, action)) return next();
    req.flash('error', 'You do not have permission to perform that action.');
    return res.redirect(req.session.user ? '/admin/profile' : '/admin/login');
  };
}

module.exports = { can, canAny, canResource, policy };
