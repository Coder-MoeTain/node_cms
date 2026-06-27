const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Tag', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT
  }, { tableName: 'tags' });
