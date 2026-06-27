const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Taxonomy', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    hierarchical: { type: DataTypes.BOOLEAN, defaultValue: false },
    post_types: DataTypes.JSON,
    public: { type: DataTypes.BOOLEAN, defaultValue: true },
    show_in_api: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'taxonomies', paranoid: false });
