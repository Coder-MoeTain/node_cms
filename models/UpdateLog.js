const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('UpdateLog', {
    component_type: { type: DataTypes.ENUM('core', 'plugin', 'theme'), defaultValue: 'core' },
    component_slug: DataTypes.STRING(160),
    from_version: DataTypes.STRING(40),
    to_version: DataTypes.STRING(40),
    status: {
      type: DataTypes.ENUM('checked', 'available', 'installed', 'failed'),
      defaultValue: 'checked'
    },
    message: DataTypes.TEXT
  }, { tableName: 'update_logs', updatedAt: false, paranoid: false });
