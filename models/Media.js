const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Media', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    thumbnail_path: DataTypes.STRING(500),
    medium_path: DataTypes.STRING(500),
    large_path: DataTypes.STRING(500),
    file_type: { type: DataTypes.ENUM('image', 'video', 'document', 'other'), allowNull: false },
    mime_type: { type: DataTypes.STRING(120), allowNull: false },
    file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    width: DataTypes.INTEGER.UNSIGNED,
    height: DataTypes.INTEGER.UNSIGNED,
    duration: DataTypes.FLOAT,
    alt_text: DataTypes.STRING(255),
    caption: DataTypes.STRING(500),
    description: DataTypes.TEXT,
    uploaded_by: DataTypes.INTEGER
  }, { tableName: 'media' });
