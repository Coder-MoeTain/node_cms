const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WidgetInstance', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    widget_area_id: { type: DataTypes.INTEGER, allowNull: false },
    widget_type: { type: DataTypes.STRING(80), allowNull: false },
    title: DataTypes.STRING(160),
    settings_json: DataTypes.TEXT('medium'),
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'widget_instances', paranoid: false });
