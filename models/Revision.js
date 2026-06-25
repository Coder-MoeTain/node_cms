const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Revision', {
    resource_type: {
      type: DataTypes.ENUM('post', 'page', 'custom_post'),
      allowNull: false
    },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },
    title: DataTypes.STRING(220),
    content: DataTypes.TEXT('medium'),
    excerpt: DataTypes.TEXT,
    block_content_json: DataTypes.TEXT('medium'),
    meta_json: DataTypes.TEXT('medium'),
    created_by: DataTypes.INTEGER
  }, { tableName: 'revisions', updatedAt: false, paranoid: false });
