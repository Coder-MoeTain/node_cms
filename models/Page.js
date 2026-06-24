const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Page', {
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    excerpt: DataTypes.TEXT,
    status: { type: DataTypes.ENUM('draft', 'published', 'private'), defaultValue: 'draft' },
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    author_id: DataTypes.INTEGER,
    published_at: DataTypes.DATE
  }, { tableName: 'pages' });
