const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('SecuritySetting', {
    key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'security_settings' });
