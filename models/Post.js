const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Post', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
    post_type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'post' },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    content_format: { type: DataTypes.ENUM('classic', 'block'), defaultValue: 'classic' },
    block_content_json: DataTypes.TEXT('medium'),
    rendered_content_cache: DataTypes.TEXT('medium'),
    excerpt: DataTypes.TEXT,
    featured_image: DataTypes.STRING(255),
    video_url: DataTypes.STRING(500),
    status: { type: DataTypes.ENUM('draft', 'pending', 'published', 'private', 'scheduled'), defaultValue: 'draft' },
    category_id: DataTypes.INTEGER,
    author_id: DataTypes.INTEGER,
    updated_by: DataTypes.INTEGER,
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    og_image: DataTypes.STRING(255),
    canonical_url: DataTypes.STRING(500),
    og_title: DataTypes.STRING(220),
    og_description: DataTypes.TEXT,
    robots_noindex: { type: DataTypes.BOOLEAN, defaultValue: false },
    robots_nofollow: { type: DataTypes.BOOLEAN, defaultValue: false },
    sitemap_include: { type: DataTypes.BOOLEAN, defaultValue: true },
    post_password_hash: DataTypes.STRING(255),
    allow_comments: { type: DataTypes.BOOLEAN, defaultValue: true },
    views_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    published_at: DataTypes.DATE
  }, { tableName: 'posts' });
