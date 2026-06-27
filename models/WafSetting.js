const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WafSetting', {
    setting_key: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    setting_value: { type: DataTypes.TEXT, allowNull: false },
    setting_type: {
      type: DataTypes.ENUM('boolean', 'string', 'number'),
      allowNull: false,
      defaultValue: 'string'
    }
  }, {
    tableName: 'waf_settings',
    paranoid: false,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
