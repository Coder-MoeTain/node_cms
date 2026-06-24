const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('PluginHook', {
    plugin_id: { type: DataTypes.INTEGER, allowNull: false },
    hook: { type: DataTypes.STRING(120), allowNull: false },
    handler: { type: DataTypes.STRING(180), allowNull: false },
    priority: { type: DataTypes.INTEGER, defaultValue: 10 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'plugin_hooks' });
