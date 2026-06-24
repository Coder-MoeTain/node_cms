const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WafIpList', {
    ip_address: { type: DataTypes.STRING(80), allowNull: false },
    list_type: {
      type: DataTypes.ENUM('blacklist', 'whitelist', 'temporary_block'),
      allowNull: false
    },
    reason: DataTypes.STRING(255),
    expires_at: DataTypes.DATE,
    status: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: DataTypes.INTEGER.UNSIGNED
  }, {
    tableName: 'waf_ip_lists',
    paranoid: false,
    indexes: [
      { unique: true, fields: ['ip_address', 'list_type'] }
    ]
  });
