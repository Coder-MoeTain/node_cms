const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('NetworkSiteSetting', {
    site_id: { type: DataTypes.INTEGER, allowNull: false },
    setting_key: { type: DataTypes.STRING(120), allowNull: false },
    setting_value: DataTypes.TEXT('medium')
  }, { tableName: 'network_site_settings', paranoid: false });
