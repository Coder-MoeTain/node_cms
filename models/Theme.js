const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Theme', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    preview_image: DataTypes.STRING(255),
    manifest: DataTypes.JSON,
    parent_slug: DataTypes.STRING(180),
    active: { type: DataTypes.BOOLEAN, defaultValue: false },
    error_state: { type: DataTypes.ENUM('none', 'error'), defaultValue: 'none' },
    last_error: DataTypes.TEXT,
    latest_version: DataTypes.STRING(40),
    update_available: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_checked_at: DataTypes.DATE
  }, { tableName: 'themes' });
