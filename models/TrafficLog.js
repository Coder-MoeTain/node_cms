const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('TrafficLog', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    request_id: { type: DataTypes.STRING(64), allowNull: false },
    ip_address: { type: DataTypes.STRING(80), allowNull: false },
    method: { type: DataTypes.STRING(12), allowNull: false },
    path: { type: DataTypes.STRING(512), allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    referer: DataTypes.TEXT,
    user_agent: DataTypes.TEXT,
    response_status: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 200 },
    response_ms: DataTypes.INTEGER.UNSIGNED,
    device_type: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'bot', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown'
    },
    browser: DataTypes.STRING(80),
    os: DataTypes.STRING(80),
    is_bot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {
    tableName: 'traffic_logs',
    paranoid: false,
    updatedAt: false
  });
