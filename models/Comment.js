const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Comment', {
    post_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_id: DataTypes.INTEGER,
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(180), allowNull: false, validate: { isEmail: true } },
    website: DataTypes.STRING(255),
    content: { type: DataTypes.TEXT, allowNull: false },
    ip_address: DataTypes.STRING(80),
    user_agent: DataTypes.STRING(255),
    status: { type: DataTypes.ENUM('pending', 'approved', 'spam', 'rejected'), defaultValue: 'pending' }
  }, { tableName: 'comments' });
