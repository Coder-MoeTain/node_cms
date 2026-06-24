const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('PluginMigration', {
    plugin_id: { type: DataTypes.INTEGER, allowNull: false },
    migration: { type: DataTypes.STRING(180), allowNull: false },
    batch: { type: DataTypes.INTEGER, defaultValue: 1 },
    ran_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'plugin_migrations',
    indexes: [{ unique: true, fields: ['plugin_id', 'migration'] }]
  });
