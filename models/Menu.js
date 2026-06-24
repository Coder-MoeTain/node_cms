const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Menu', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    location: { type: DataTypes.ENUM('header', 'footer', 'sidebar'), defaultValue: 'header' },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'menus' });
