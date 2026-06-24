const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Slider', {
    title: { type: DataTypes.STRING(180), allowNull: false },
    description: DataTypes.TEXT,
    image: DataTypes.STRING(255),
    button_text: DataTypes.STRING(80),
    button_url: DataTypes.STRING(500),
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'sliders' });
