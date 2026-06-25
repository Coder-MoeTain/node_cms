const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('TemplatePart', {
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    part_type: { type: DataTypes.STRING(80), allowNull: false },
    theme_slug: DataTypes.STRING(120),
    block_content_json: DataTypes.TEXT('medium'),
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
    created_by: DataTypes.INTEGER
  }, { tableName: 'template_parts', paranoid: false });
