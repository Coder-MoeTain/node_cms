const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('SiteUser', {
    site_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role_slug: { type: DataTypes.STRING(80), defaultValue: 'admin' }
  }, { tableName: 'site_users', updatedAt: false, paranoid: false });
