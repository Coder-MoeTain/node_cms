const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('ContentTranslation', {
    resource_type: {
      type: DataTypes.ENUM('post', 'page', 'custom_post', 'category', 'tag'),
      allowNull: false
    },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },
    locale: { type: DataTypes.STRING(10), allowNull: false },
    title: DataTypes.STRING(220),
    excerpt: DataTypes.TEXT,
    content: DataTypes.TEXT('medium'),
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT
  }, { tableName: 'content_translations', paranoid: false });
