const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Role', {
    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: DataTypes.TEXT
  }, { tableName: 'roles' });
