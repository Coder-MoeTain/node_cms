const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Media', {
    filename: { type: DataTypes.STRING(255), allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_type: { type: DataTypes.ENUM('image', 'video', 'document', 'other'), allowNull: false },
    mime_type: { type: DataTypes.STRING(120), allowNull: false },
    file_size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    uploaded_by: DataTypes.INTEGER
  }, { tableName: 'media' });
