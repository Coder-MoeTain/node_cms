const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('CustomFieldValue', {
    custom_field_id: { type: DataTypes.INTEGER, allowNull: false },
    resource_type: {
      type: DataTypes.ENUM('post', 'page', 'custom_post'),
      defaultValue: 'custom_post'
    },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },
    value_text: DataTypes.TEXT('medium')
  }, { tableName: 'custom_field_values', paranoid: false });
