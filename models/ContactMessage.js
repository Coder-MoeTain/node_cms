const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('ContactMessage', {
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(180), allowNull: false, validate: { isEmail: true } },
    phone: DataTypes.STRING(40),
    subject: { type: DataTypes.STRING(180), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('unread', 'read'), defaultValue: 'unread' }
  }, { tableName: 'contact_messages' });
