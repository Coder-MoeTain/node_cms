const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Category', {
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    parent_id: DataTypes.INTEGER,
    image: DataTypes.STRING(255)
  }, { tableName: 'categories' });
