const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('ThemeSetting', {
    theme_name: { type: DataTypes.STRING(120), allowNull: false },
    primary_color: { type: DataTypes.STRING(20), defaultValue: '#0d6efd' },
    secondary_color: { type: DataTypes.STRING(20), defaultValue: '#6c757d' },
    background_color: { type: DataTypes.STRING(20), defaultValue: '#ffffff' },
    text_color: { type: DataTypes.STRING(20), defaultValue: '#212529' },
    font_family: { type: DataTypes.STRING(120), defaultValue: 'Inter, Arial, sans-serif' },
    header_layout: { type: DataTypes.STRING(80), defaultValue: 'standard' },
    footer_layout: { type: DataTypes.STRING(80), defaultValue: 'four-columns' },
    sidebar_position: { type: DataTypes.ENUM('left', 'right', 'none'), defaultValue: 'right' },
    blog_layout: { type: DataTypes.ENUM('grid', 'list', 'masonry'), defaultValue: 'grid' },
    site_layout: { type: DataTypes.ENUM('full-width', 'boxed'), defaultValue: 'full-width' },
    dark_mode: { type: DataTypes.BOOLEAN, defaultValue: false },
    logo: DataTypes.STRING(255),
    favicon: DataTypes.STRING(255),
    active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'theme_settings' });
