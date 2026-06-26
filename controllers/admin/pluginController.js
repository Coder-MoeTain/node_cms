const fs = require('fs');
const path = require('path');
const { Plugin, PluginSetting, PluginMigration } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const pluginInstaller = require('../../utils/pluginInstaller');
const { resolvePluginSettings, seedPluginDefaults } = require('../../utils/pluginSettings');
const { logPluginAudit, createActivityLog } = require('../../utils/activityLogHelper');
const {
  enrichPlugin,
  readPluginReadme,
  bulkActivate,
  bulkDeactivate,
  bulkUninstall,
  getPendingMigrationFiles
} = require('../../utils/pluginAdmin');

function logPluginAction(req, action, details = {}) {
  return logPluginAudit(req, action, details);
}

async function show(req, res, next) {
  try {
    const plugin = await Plugin.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: PluginSetting, as: 'settings' },
        { model: PluginMigration, as: 'migrations' }
      ]
    });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const enriched = enrichPlugin(plugin, { activationErrors: Object.fromEntries(pluginLoader.getActivationErrors()) });
    const pendingMigrations = getPendingMigrationFiles(plugin.slug, plugin.migrations || []);
    const activationErrors = pluginLoader.getActivationErrors();
    const registeredHooks = pluginLoader.listRegisteredHooks();
    const manifestHooks = (plugin.manifest?.hooks || []);
    const readme = readPluginReadme(plugin.slug);

    return res.render('admin/plugins/show', {
      title: plugin.name,
      plugin: enriched,
      readme,
      pendingMigrations,
      registeredHooks,
      manifestHooks,
      activationError: activationErrors.get(plugin.slug) || null,
      isActive: plugin.active
    });
  } catch (error) {
    return next(error);
  }
}

async function runMigrations(req, res, next) {
  try {
    const slug = req.params.slug;
    const plugin = await Plugin.findOne({ where: { slug } });
    if (!plugin) {
      req.flash('error', 'Plugin not found.');
      return res.redirect('/admin/plugins');
    }
    const ran = await pluginLoader.runPluginMigrations(slug);
    await logPluginAction(req, 'plugin_migrate', { slug, migrations: ran });
    req.flash('success', ran.length ? `Ran ${ran.length} migration(s): ${ran.join(', ')}` : 'No pending migrations.');
    return res.redirect(`/admin/plugins/${slug}`);
  } catch (error) {
    req.flash('error', error.message || 'Migration failed.');
    return res.redirect(`/admin/plugins/${req.params.slug}`);
  }
}

async function index(req, res, next) {
  try {
    await pluginLoader.syncInstalledPlugins();
    const [plugins, stats, registeredHooks] = await Promise.all([
      Plugin.findAll({
        order: [['name', 'ASC']],
        include: [{ model: PluginMigration, as: 'migrations' }]
      }),
      pluginLoader.getPluginManagerStats(),
      Promise.resolve(pluginLoader.listRegisteredHooks())
    ]);
    const activationErrors = Object.fromEntries(pluginLoader.getActivationErrors());
    const enriched = plugins.map((plugin) => enrichPlugin(plugin, { activationErrors }));
    const safeMode = pluginLoader.isSafeMode();

    return res.render('admin/plugins/index', {
      title: 'Plugins',
      plugins: enriched,
      stats,
      registeredHooks,
      activationErrors,
      safeMode
    });
  } catch (error) {
    return next(error);
  }
}

async function pluginsJson(req, res, next) {
  try {
    await pluginLoader.syncInstalledPlugins();
    const plugins = await Plugin.findAll({
      order: [['name', 'ASC']],
      include: [{ model: PluginMigration, as: 'migrations' }]
    });
    const activationErrors = Object.fromEntries(pluginLoader.getActivationErrors());
    const stats = await pluginLoader.getPluginManagerStats();
    return res.json({
      stats,
      plugins: plugins.map((plugin) => enrichPlugin(plugin, { activationErrors })),
      registeredHooks: pluginLoader.listRegisteredHooks(),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

async function syncPlugins(req, res, next) {
  try {
    const discovered = await pluginLoader.syncInstalledPlugins();
    await pluginLoader.loadActivePlugins(req.app);
    await logPluginAction(req, 'plugin_sync', { count: discovered.length });
    req.flash('success', `Synced ${discovered.length} plugin(s) from disk.`);
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function bulkAction(req, res, next) {
  try {
    const action = req.body.action;
    const slugs = [].concat(req.body.slugs || req.body['slugs[]'] || []).filter(Boolean);
    if (!slugs.length) {
      req.flash('error', 'Select at least one plugin.');
      return res.redirect('/admin/plugins');
    }

    let results;
    if (action === 'activate') results = await bulkActivate(slugs, req.app);
    else if (action === 'deactivate') results = await bulkDeactivate(slugs, req.app);
    else if (action === 'delete') results = await bulkUninstall(slugs, req.app);
    else {
      req.flash('error', 'Unknown bulk action.');
      return res.redirect('/admin/plugins');
    }

    await logPluginAction(req, `plugin_bulk_${action}`, {
      slugs,
      succeeded: results.succeeded,
      failed: results.failed
    });

    if (results.succeeded.length) {
      req.flash('success', `${results.succeeded.length} plugin(s) updated (${action}).`);
    }
    if (results.failed.length) {
      const summary = results.failed.map((row) => `${row.slug}: ${row.error}`).join('; ');
      req.flash('error', summary);
    }
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) {
      req.flash('error', 'Choose a plugin .zip archive to upload.');
      return res.redirect('/admin/plugins');
    }
    const overwrite = req.body.overwrite === 'on' || req.body.overwrite === 'true';
    const { manifest } = await pluginInstaller.installFromZip(req.file.path, { overwrite });
    pluginLoader.validateManifest(manifest, { pluginPath: path.join(pluginLoader.pluginsRoot, manifest.slug), strict: false });
    const isNew = !(await Plugin.findOne({ where: { slug: manifest.slug } }));
    await pluginLoader.syncInstalledPlugins();
    await pluginLoader.runPluginMigrations(manifest.slug);
    if (isNew) {
      await pluginLoader.invokePluginLifecycle(manifest.slug, 'onInstall', req.app);
    }
    if (req.body.activate_after === 'on') {
      try {
        await pluginLoader.activatePlugin(manifest.slug, req.app, req.session?.user);
      } catch (error) {
        req.flash('error', `Installed but activation failed: ${error.message}`);
        return res.redirect('/admin/plugins');
      }
    }
    await logPluginAction(req, 'plugin.installed', { slug: manifest.slug, version: manifest.version, isNew });
    req.flash('success', `Plugin "${manifest.name}" installed successfully.`);
    return res.redirect('/admin/plugins');
  } catch (error) {
    await logPluginAction(req, 'plugin.error', { slug: req.body.slug, status: 'failed', details: { message: error.message } });
    req.flash('error', error.message || 'Plugin upload failed.');
    return res.redirect('/admin/plugins');
  }
}

async function activate(req, res, next) {
  try {
    const slug = req.params.slug;
    await pluginLoader.activatePlugin(slug, req.app);
    await logPluginAction(req, 'plugin.activated', { slug });
    req.flash('success', 'Plugin activated.');
    const redirectTo = req.body.redirect || '/admin/plugins';
    return res.redirect(redirectTo);
  } catch (error) {
    req.flash('error', error.message || 'Plugin activation failed.');
    return res.redirect(req.body.redirect || '/admin/plugins');
  }
}

async function deactivate(req, res, next) {
  try {
    const slug = req.params.slug;
    await pluginLoader.deactivatePlugin(slug, req.app);
    await logPluginAction(req, 'plugin.deactivated', { slug });
    req.flash('success', 'Plugin deactivated.');
    const redirectTo = req.body.redirect || '/admin/plugins';
    return res.redirect(redirectTo);
  } catch (error) {
    return next(error);
  }
}

async function uninstall(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug } });
    if (!plugin) {
      req.flash('error', 'Plugin not found.');
      return res.redirect('/admin/plugins');
    }
    if (plugin.active) {
      req.flash('error', 'Deactivate the plugin before uninstalling.');
      return res.redirect('/admin/plugins');
    }
    await pluginLoader.invokePluginLifecycle(plugin.slug, 'onUninstall', req.app);
    await PluginMigration.destroy({ where: { plugin_id: plugin.id } });
    await PluginSetting.destroy({ where: { plugin_id: plugin.id } });
    await plugin.destroy();
    pluginLoader.removePluginDirectory(plugin.slug);
    await logPluginAction(req, 'plugin.uninstalled', { slug: req.params.slug });
    req.flash('success', 'Plugin removed.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function settings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({
      where: { slug: req.params.slug },
      include: [{ model: PluginSetting, as: 'settings' }]
    });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const manifest = plugin.manifest || {};
    const storedMap = {};
    (plugin.settings || []).forEach((setting) => { storedMap[setting.key] = setting.value; });
    const settingsMap = resolvePluginSettings(storedMap, manifest);
    const manifestFields = manifest.settings || [];
    const fields = manifestFields.length
      ? manifestFields
      : [
        { key: 'note', label: 'Enabled Note', type: 'text', placeholder: 'Internal note' },
        { key: 'public_snippet', label: 'Public Snippet', type: 'textarea', placeholder: 'Snippet for hooks' }
      ];

    return res.render('admin/plugins/settings', {
      title: `${plugin.name} Settings`,
      plugin: enrichPlugin(plugin),
      settingsMap,
      fields,
      usesManifestSettings: manifestFields.length > 0
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug } });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const manifest = plugin.manifest || {};
    const manifestFields = manifest.settings || [];
    const fields = manifestFields.length
      ? manifestFields
      : [
        { key: 'note', type: 'text' },
        { key: 'public_snippet', type: 'textarea' }
      ];

    for (const field of fields) {
      if (!field.key) continue;
      let value;
      if (field.type === 'checkbox') {
        value = req.body[field.key] === 'on' ? 'true' : 'false';
      } else {
        value = req.body[field.key];
        if (value === undefined) continue;
        if (Array.isArray(value)) value = value.join(',');
      }
      await PluginSetting.upsert({
        plugin_id: plugin.id,
        key: field.key,
        value: String(value ?? ''),
        value_type: field.type === 'checkbox' ? 'boolean' : 'string'
      });
    }

    if (plugin.active) await pluginLoader.loadActivePlugins(req.app);
    await logPluginAction(req, 'plugin.settings_updated', { slug: plugin.slug });
    req.flash('success', 'Plugin settings saved.');
    return res.redirect(`/admin/plugins/${plugin.slug}/settings`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  show,
  upload,
  activate,
  deactivate,
  uninstall,
  settings,
  updateSettings,
  runMigrations,
  syncPlugins,
  bulkAction,
  pluginsJson
};
