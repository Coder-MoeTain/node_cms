const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('TaxonomyTerm', {
    taxonomy_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(180), allowNull: false },
    description: DataTypes.TEXT,
    parent_id: DataTypes.INTEGER.UNSIGNED,
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 }
  }, { tableName: 'taxonomy_terms', paranoid: false });
