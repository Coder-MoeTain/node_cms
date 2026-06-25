const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Site', {
    name: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    domain: DataTypes.STRING(255),
    path: { type: DataTypes.STRING(255), defaultValue: '/' },
    status: { type: DataTypes.ENUM('active', 'inactive', 'archived'), defaultValue: 'active' },
    owner_id: DataTypes.INTEGER
  }, { tableName: 'sites', paranoid: false });
