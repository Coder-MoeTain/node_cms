const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('TwoFactorRecoveryCode', {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    code_hash: { type: DataTypes.STRING(255), allowNull: false },
    used_at: DataTypes.DATE
  }, { tableName: 'two_factor_recovery_codes' });
