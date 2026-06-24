const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WafLog', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    request_id: { type: DataTypes.STRING(64), allowNull: false },
    ip_address: { type: DataTypes.STRING(80), allowNull: false },
    method: { type: DataTypes.STRING(12), allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    route_type: DataTypes.STRING(40),
    user_agent: DataTypes.TEXT,
    headers_snapshot: DataTypes.JSON,
    query_snapshot: DataTypes.JSON,
    body_snapshot: DataTypes.JSON,
    file_snapshot: DataTypes.JSON,
    matched_rule_id: DataTypes.INTEGER.UNSIGNED,
    matched_rule_name: DataTypes.STRING(160),
    category: DataTypes.STRING(80),
    severity: DataTypes.STRING(20),
    action_taken: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'log' },
    risk_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    country: DataTypes.STRING(80),
    referer: DataTypes.TEXT,
    is_admin_route: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    user_id: DataTypes.INTEGER,
    response_status: DataTypes.INTEGER.UNSIGNED
  }, {
    tableName: 'waf_logs',
    paranoid: false,
    updatedAt: false
  });
