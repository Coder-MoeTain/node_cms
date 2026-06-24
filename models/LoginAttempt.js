const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('LoginAttempt', {
    email: DataTypes.STRING(180),
    ip_address: { type: DataTypes.STRING(80), allowNull: false },
    user_agent: DataTypes.STRING(255),
    success: { type: DataTypes.BOOLEAN, defaultValue: false },
    reason: DataTypes.STRING(255)
  }, { tableName: 'login_attempts' });
