const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('ActivityLog', {
    user_id: DataTypes.INTEGER,
    action: { type: DataTypes.STRING(160), allowNull: false },
    entity_type: DataTypes.STRING(80),
    entity_id: DataTypes.INTEGER,
    ip_address: DataTypes.STRING(80),
    user_agent: DataTypes.STRING(255),
    metadata: DataTypes.JSON
  }, { tableName: 'activity_logs' });
