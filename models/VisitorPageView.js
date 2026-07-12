const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('VisitorPageView', {
    site_id: DataTypes.INTEGER.UNSIGNED,
    path: { type: DataTypes.STRING(512), allowNull: false },
    referrer: DataTypes.STRING(512),
    user_agent: DataTypes.STRING(512),
    session_hash: DataTypes.STRING(64),
    ip_hash: DataTypes.STRING(64),
    viewed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'visitor_page_views',
    paranoid: false,
    timestamps: false
  });
