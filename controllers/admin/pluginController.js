const { Plugin, PluginSetting } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');

async function index(req, res, next) {
  try {
    await pluginLoader.syncInstalledPlugins();
    const plugins = await Plugin.findAll({ order: [['name', 'ASC']] });
    return res.render('admin/plugins/index', { title: 'Plugins', plugins });
  } catch (error) {
    return next(error);
  }
}

async function activate(req, res, next) {
  try {
    await Plugin.update({ active: true }, { where: { slug: req.params.slug } });
    await pluginLoader.loadActivePlugins(req.app);
    req.flash('success', 'Plugin activated.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function deactivate(req, res, next) {
  try {
    await Plugin.update({ active: false }, { where: { slug: req.params.slug } });
    await pluginLoader.loadActivePlugins(req.app);
    req.flash('success', 'Plugin deactivated.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function settings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug }, include: [{ model: PluginSetting, as: 'settings' }] });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });
    return res.render('admin/plugins/settings', { title: `${plugin.name} Settings`, plugin });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug } });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });
    for (const [key, value] of Object.entries(req.body)) {
      if (['_csrf', '_method'].includes(key)) continue;
      await PluginSetting.upsert({ plugin_id: plugin.id, key, value, value_type: 'string' });
    }
    req.flash('success', 'Plugin settings saved.');
    return res.redirect(`/admin/plugins/${plugin.slug}/settings`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, activate, deactivate, settings, updateSettings };
