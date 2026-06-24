const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('PluginSetting', {
    plugin_id: { type: DataTypes.INTEGER, allowNull: false },
    key: { type: DataTypes.STRING(120), allowNull: false },
    value: DataTypes.TEXT,
    value_type: { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' }
  }, {
    tableName: 'plugin_settings',
    indexes: [{ unique: true, fields: ['plugin_id', 'key'] }]
  });
