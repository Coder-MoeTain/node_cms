const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Permission', {
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    slug: { type: DataTypes.STRING(140), allowNull: false, unique: true },
    description: DataTypes.TEXT
  }, { tableName: 'permissions' });
