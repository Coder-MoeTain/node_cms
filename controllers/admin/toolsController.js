const { runChecks } = require('../../utils/siteHealth');
const policy = require('../../utils/policy');

async function siteHealth(req, res, next) {
  try {
    if (!policy.hasAnyPermission(req.session.user, ['manage_settings', 'manage_security'])) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const report = await runChecks();
    return res.render('admin/tools/health', { title: 'Site Health', report });
  } catch (error) {
    return next(error);
  }
}

async function siteHealthJson(req, res, next) {
  try {
    if (!policy.hasAnyPermission(req.session.user, ['manage_settings', 'manage_security'])) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const report = await runChecks();
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    return res.render('admin/tools/index', { title: 'Tools' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { siteHealth, siteHealthJson, index };
