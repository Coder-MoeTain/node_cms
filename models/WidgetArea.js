const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WidgetArea', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    description: DataTypes.STRING(500),
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'widget_areas', paranoid: false });
