const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('SlugRedirect', {
    resource_type: { type: DataTypes.ENUM('post', 'page'), allowNull: false },
    resource_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    old_slug: { type: DataTypes.STRING(240), allowNull: false }
  }, {
    tableName: 'slug_redirects',
    updatedAt: false,
    paranoid: false,
    timestamps: true,
    createdAt: 'created_at'
  });
