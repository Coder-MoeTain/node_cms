const pkg = require('../../package.json');
const models = require('../../models');
const policy = require('../../utils/policy');
const { runUpdateCheck } = require('../../utils/updateChecker');

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const report = await runUpdateCheck();
    const logs = await models.UpdateLog.findAll({ order: [['created_at', 'DESC']], limit: 20 });
    return res.render('admin/updates/index', {
      title: 'Updates',
      version: pkg.version,
      report,
      logs
    });
  } catch (error) {
    return next(error);
  }
}

async function check(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/updates');
    }
    await runUpdateCheck();
    req.flash('success', 'Update check completed.');
    return res.redirect('/admin/updates');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, check };
