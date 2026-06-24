const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Post', {
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    excerpt: DataTypes.TEXT,
    featured_image: DataTypes.STRING(255),
    video_url: DataTypes.STRING(500),
    status: { type: DataTypes.ENUM('draft', 'published', 'private', 'scheduled'), defaultValue: 'draft' },
    category_id: DataTypes.INTEGER,
    author_id: DataTypes.INTEGER,
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    og_image: DataTypes.STRING(255),
    allow_comments: { type: DataTypes.BOOLEAN, defaultValue: true },
    views_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    published_at: DataTypes.DATE
  }, { tableName: 'posts' });
