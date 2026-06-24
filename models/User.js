const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('User', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(180), allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role_id: DataTypes.INTEGER,
    profile_image: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('active', 'disabled', 'pending'), defaultValue: 'active' },
    force_password_change: { type: DataTypes.BOOLEAN, defaultValue: false },
    failed_login_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    locked_until: DataTypes.DATE,
    two_factor_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    two_factor_secret: DataTypes.STRING(255),
    last_login: DataTypes.DATE,
    remember_token: DataTypes.STRING(255),
    reset_token: DataTypes.STRING(255),
    reset_token_expires: DataTypes.DATE
  }, { tableName: 'users' });
