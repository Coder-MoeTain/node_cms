const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Autosave', {
    resource_type: {
      type: DataTypes.ENUM('post', 'page', 'custom_post'),
      allowNull: false
    },
    resource_id: { type: DataTypes.INTEGER, allowNull: false },
    draft_data_json: { type: DataTypes.TEXT('medium'), allowNull: false },
    created_by: DataTypes.INTEGER
  }, { tableName: 'autosaves', createdAt: false, paranoid: false });
