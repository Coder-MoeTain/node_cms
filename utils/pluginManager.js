/**
 * Commercial plugin manager facade — wraps pluginLoader with a WordPress-like API.
 */
const pluginLoader = require('./pluginLoader');
const pluginValidator = require('./pluginValidator');
const pluginInstaller = require('./pluginInstaller');

module.exports = {
  ...pluginLoader,
  pluginValidator,
  pluginInstaller,
  discoverPlugins: pluginLoader.discoverPlugins,
  getPlugin: pluginLoader.getPlugin,
  validatePlugin: pluginLoader.validatePlugin,
  activatePlugin: pluginLoader.activatePlugin,
  deactivatePlugin: pluginLoader.deactivatePlugin,
  uninstallPlugin: pluginLoader.uninstallPlugin,
  loadActivePlugins: pluginLoader.loadActivePlugins,
  reloadPlugin: pluginLoader.reloadPlugin,
  getPluginSettings: pluginLoader.getPluginSettings,
  savePluginSettings: pluginLoader.savePluginSettings,
  runPluginMigrations: pluginLoader.runPluginMigrations,
  rollbackPluginMigration: pluginLoader.rollbackPluginMigration,
  registerPluginRoutes: pluginLoader.registerPluginRoutes,
  registerPluginAssets: pluginLoader.registerPluginAssets,
  getPluginHealth: pluginLoader.getPluginHealth,
  installFromZip: pluginInstaller.installFromZip
};
