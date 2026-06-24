const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('MenuItem', {
    menu_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_id: DataTypes.INTEGER,
    title: { type: DataTypes.STRING(160), allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    item_type: { type: DataTypes.ENUM('custom', 'page', 'category', 'post'), defaultValue: 'custom' },
    reference_id: DataTypes.INTEGER,
    target: { type: DataTypes.ENUM('_self', '_blank'), defaultValue: '_self' },
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'menu_items' });
