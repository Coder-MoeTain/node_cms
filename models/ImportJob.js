const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('ImportJob', {
    job_type: { type: DataTypes.STRING(40), defaultValue: 'json' },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'rolled_back'),
      defaultValue: 'pending'
    },
    source_filename: DataTypes.STRING(255),
    summary_json: DataTypes.TEXT('medium'),
    log_text: DataTypes.TEXT('medium'),
    created_by: DataTypes.INTEGER
  }, { tableName: 'import_jobs', paranoid: false });
