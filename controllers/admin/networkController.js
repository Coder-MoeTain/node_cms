const appConfig = require('../../config/app');
const models = require('../../models');
const policy = require('../../utils/policy');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const { setNetworkSiteSetting, listNetworkSiteSettings } = require('../../utils/networkSiteSettings');

async function index(req, res, next) {
  try {
    if (!appConfig.multisiteEnabled) {
      req.flash('error', 'Multisite is disabled. Set MULTISITE_ENABLED=true to enable.');
      return res.redirect('/admin');
    }
    if (!policy.isSuperAdmin(req.session.user)) {
      req.flash('error', 'Only Super Admins can manage the network.');
      return res.redirect('/admin');
    }
    const sites = await models.Site.findAll({
      include: [{ model: models.SiteDomain, as: 'domains' }],
      order: [['name', 'ASC']]
    });
    return res.render('admin/network/index', { title: 'Network Sites', sites });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!appConfig.multisiteEnabled || !policy.isSuperAdmin(req.session.user)) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/network');
    }
    return res.render('admin/network/form', { title: 'Add Site', record: {} });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    if (!appConfig.multisiteEnabled || !policy.isSuperAdmin(req.session.user)) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/network');
    }
    const slug = await createUniqueSlug(models.Site, req.body.slug || req.body.name, 'site');
    const site = await models.Site.create({
      name: req.body.name,
      slug,
      domain: req.body.domain || null,
      path: req.body.path || '/',
      status: 'active',
      owner_id: req.session.user.id
    });
    if (req.body.domain) {
      await models.SiteDomain.create({ site_id: site.id, domain: req.body.domain, is_primary: true });
    }
    req.flash('success', 'Site created.');
    return res.redirect('/admin/network');
  } catch (error) {
    return next(error);
  }
}

async function settingsForm(req, res, next) {
  try {
    if (!appConfig.multisiteEnabled || !policy.isSuperAdmin(req.session.user)) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/network');
    }
    const site = await models.Site.findByPk(req.params.id);
    if (!site) return res.status(404).render('errors/404', { title: 'Not Found' });
    const rows = await listNetworkSiteSettings(site.id);
    const settings = rows.reduce((map, row) => ({ ...map, [row.setting_key]: row.setting_value }), {});
    return res.render('admin/network/settings', {
      title: `${site.name} Settings`,
      site,
      settings
    });
  } catch (error) {
    return next(error);
  }
}

async function settingsUpdate(req, res, next) {
  try {
    if (!appConfig.multisiteEnabled || !policy.isSuperAdmin(req.session.user)) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/network');
    }
    const site = await models.Site.findByPk(req.params.id);
    if (!site) return res.status(404).render('errors/404', { title: 'Not Found' });
    for (const key of ['public_site_title', 'public_site_tagline']) {
      if (req.body[key] !== undefined) {
        await setNetworkSiteSetting(site.id, key, String(req.body[key]).trim());
      }
    }
    req.flash('success', 'Site settings saved.');
    return res.redirect(`/admin/network/${site.id}/settings`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, create, store, settingsForm, settingsUpdate };
