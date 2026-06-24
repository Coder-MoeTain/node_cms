const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WafRateLimit', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    ip_address: { type: DataTypes.STRING(80), allowNull: false },
    route_key: { type: DataTypes.STRING(180), allowNull: false },
    request_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    first_request_at: { type: DataTypes.DATE, allowNull: false },
    last_request_at: { type: DataTypes.DATE, allowNull: false },
    blocked_until: DataTypes.DATE
  }, {
    tableName: 'waf_rate_limits',
    paranoid: false,
    indexes: [
      { unique: true, fields: ['ip_address', 'route_key'] }
    ]
  });
