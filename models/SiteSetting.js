const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('SiteSetting', {
    key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    value: DataTypes.TEXT,
    group: { type: DataTypes.STRING(80), defaultValue: 'general' }
  }, { tableName: 'site_settings' });
