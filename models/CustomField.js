const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('CustomField', {
    field_group_id: { type: DataTypes.INTEGER, allowNull: false },
    label: { type: DataTypes.STRING(120), allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    type: {
      type: DataTypes.ENUM(
        'text', 'textarea', 'rich_text', 'number', 'date', 'datetime',
        'select', 'checkbox', 'radio', 'image', 'file', 'url', 'email', 'color', 'repeater', 'group'
      ),
      defaultValue: 'text'
    },
    options_json: DataTypes.TEXT,
    default_value: DataTypes.TEXT,
    placeholder: DataTypes.STRING(255),
    help_text: DataTypes.STRING(500),
    is_required: { type: DataTypes.BOOLEAN, defaultValue: false },
    validation_rules: DataTypes.STRING(500),
    display_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'custom_fields', paranoid: false });
