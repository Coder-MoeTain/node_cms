const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('CustomPostType', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    icon: { type: DataTypes.STRING(80), defaultValue: 'bi-file-earmark' },
    supports_title: { type: DataTypes.BOOLEAN, defaultValue: true },
    supports_editor: { type: DataTypes.BOOLEAN, defaultValue: true },
    supports_excerpt: { type: DataTypes.BOOLEAN, defaultValue: true },
    supports_featured_image: { type: DataTypes.BOOLEAN, defaultValue: true },
    supports_comments: { type: DataTypes.BOOLEAN, defaultValue: false },
    supports_revisions: { type: DataTypes.BOOLEAN, defaultValue: true },
    supports_custom_fields: { type: DataTypes.BOOLEAN, defaultValue: true },
    has_archive: { type: DataTypes.BOOLEAN, defaultValue: true },
    show_in_menu: { type: DataTypes.BOOLEAN, defaultValue: true },
    show_in_api: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
  }, { tableName: 'custom_post_types', paranoid: false });
