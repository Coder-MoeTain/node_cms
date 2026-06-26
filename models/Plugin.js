const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Plugin', {
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    version: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '1.0.0' },
    description: DataTypes.TEXT,
    author: DataTypes.STRING(160),
    active: { type: DataTypes.BOOLEAN, defaultValue: false },
    installed: { type: DataTypes.BOOLEAN, defaultValue: true },
    manifest: DataTypes.JSON,
    error_state: { type: DataTypes.ENUM('none', 'error'), defaultValue: 'none' },
    last_error: DataTypes.TEXT,
    latest_version: DataTypes.STRING(40),
    update_available: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_checked_at: DataTypes.DATE
  }, { tableName: 'plugins' });
