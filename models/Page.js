const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Page', {
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    content_format: { type: DataTypes.ENUM('classic', 'block'), defaultValue: 'classic' },
    block_content_json: DataTypes.TEXT('medium'),
    rendered_content_cache: DataTypes.TEXT('medium'),
    excerpt: DataTypes.TEXT,
    featured_image: DataTypes.STRING(255),
    og_image: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('draft', 'published', 'private'), defaultValue: 'draft' },
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    author_id: DataTypes.INTEGER,
    published_at: DataTypes.DATE
  }, { tableName: 'pages' });
