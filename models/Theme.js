const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Theme', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    preview_image: DataTypes.STRING(255),
    active: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: 'themes' });
