const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('PasswordResetToken', {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token_hash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: DataTypes.DATE,
    ip_address: DataTypes.STRING(80),
    user_agent: DataTypes.STRING(500)
  }, { tableName: 'password_reset_tokens' });
