const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Banner', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    title: { type: DataTypes.STRING(180), allowNull: false },
    subtitle: DataTypes.STRING(255),
    image: DataTypes.STRING(255),
    button_text: DataTypes.STRING(80),
    button_link: DataTypes.STRING(500),
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'banners' });
