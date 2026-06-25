const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('FieldGroup', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    location_type: {
      type: DataTypes.ENUM('post_type', 'page', 'category', 'tag', 'custom_post_type'),
      defaultValue: 'post_type'
    },
    location_value: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'post' },
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'field_groups', paranoid: false });
