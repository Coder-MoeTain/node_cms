const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('Comment', {
    site_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    post_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(180), allowNull: false, validate: { isEmail: true } },
    website: DataTypes.STRING(255),
    content: { type: DataTypes.TEXT, allowNull: false },
    ip_address: DataTypes.STRING(80),
    user_agent: DataTypes.STRING(255),
    approved_by: DataTypes.INTEGER,
    approved_at: DataTypes.DATE,
    status: { type: DataTypes.ENUM('pending', 'approved', 'spam', 'rejected', 'trash'), defaultValue: 'pending' }
  }, { tableName: 'comments' });
