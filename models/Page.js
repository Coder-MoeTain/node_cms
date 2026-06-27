const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Page', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    title: { type: DataTypes.STRING(220), allowNull: false },
    slug: { type: DataTypes.STRING(240), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT('long'), allowNull: false },
    content_format: { type: DataTypes.ENUM('classic', 'block'), defaultValue: 'classic' },
    block_content_json: DataTypes.TEXT('medium'),
    rendered_content_cache: DataTypes.TEXT('medium'),
    excerpt: DataTypes.TEXT,
    featured_image: DataTypes.STRING(255),
    og_image: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('draft', 'pending', 'published', 'private', 'scheduled'), defaultValue: 'draft' },
    seo_title: DataTypes.STRING(220),
    seo_description: DataTypes.TEXT,
    author_id: DataTypes.INTEGER,
    updated_by: DataTypes.INTEGER,
    canonical_url: DataTypes.STRING(500),
    og_title: DataTypes.STRING(220),
    og_description: DataTypes.TEXT,
    robots_noindex: { type: DataTypes.BOOLEAN, defaultValue: false },
    robots_nofollow: { type: DataTypes.BOOLEAN, defaultValue: false },
    sitemap_include: { type: DataTypes.BOOLEAN, defaultValue: true },
    page_password_hash: DataTypes.STRING(255),
    parent_id: DataTypes.INTEGER.UNSIGNED,
    menu_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    published_at: DataTypes.DATE
  }, { tableName: 'pages' });
