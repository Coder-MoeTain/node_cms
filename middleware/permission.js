function can(permission) {
  return (req, res, next) => {
    const permissions = req.session.user?.permissions || [];
    if (req.session.user?.role === 'super-admin' || permissions.includes(permission)) {
      return next();
    }
    req.flash('error', 'You do not have permission to access that section.');
    return res.redirect('/admin');
  };
}

module.exports = { can };
