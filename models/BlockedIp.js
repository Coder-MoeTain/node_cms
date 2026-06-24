const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('BlockedIp', {
    ip_address: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    reason: DataTypes.STRING(255),
    blocked_by: DataTypes.INTEGER,
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'blocked_ips' });
