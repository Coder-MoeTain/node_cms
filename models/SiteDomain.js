const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('SiteDomain', {
    site_id: { type: DataTypes.INTEGER, allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    is_primary: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: 'site_domains', updatedAt: false, paranoid: false });
