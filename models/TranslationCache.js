const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'TranslationCache',
    {
      source_hash: { type: DataTypes.CHAR(64), allowNull: false },
      source_locale: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      target_locale: { type: DataTypes.STRING(10), allowNull: false },
      source_text: { type: DataTypes.TEXT('medium'), allowNull: false },
      translated_text: { type: DataTypes.TEXT('medium'), allowNull: false }
    },
    { tableName: 'translation_cache', updatedAt: 'updated_at', createdAt: 'created_at', paranoid: false }
  );
