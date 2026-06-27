const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('PostTaxonomyTerm', {
    post_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
    term_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true }
  }, { tableName: 'post_taxonomy_terms', timestamps: false, paranoid: false });
