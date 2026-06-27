const policy = require('../../utils/policy');
const { getCatalog, filterCatalog } = require('../../utils/marketplaceClient');
const { discoverPlugins } = require('../../utils/pluginLoader');

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_plugins')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/plugins');
    }
    const catalog = filterCatalog(await getCatalog(), { type: req.query.type, query: req.query.q });
    const installed = new Set((discoverPlugins() || []).map((p) => p.manifest?.slug || p.slug));
    return res.render('admin/plugins/marketplace', {
      title: 'Plugin Marketplace',
      catalog,
      installed,
      query: req.query.q || '',
      type: req.query.type || 'all'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index };
