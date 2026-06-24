const { Sequelize } = require('sequelize');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const sequelize = new Sequelize(
  (isTest && process.env.TEST_DB_NAME) || process.env.DB_NAME || 'nodepress_cms',
  (isTest && process.env.TEST_DB_USER) || process.env.DB_USER || 'root',
  (isTest && process.env.TEST_DB_PASSWORD) || process.env.DB_PASSWORD || '',
  {
    host: (isTest && process.env.TEST_DB_HOST) || process.env.DB_HOST || '127.0.0.1',
    port: Number((isTest && process.env.TEST_DB_PORT) || process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? false : false,
    define: {
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at'
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
