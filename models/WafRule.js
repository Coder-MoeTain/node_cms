const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define('WafRule', {
    name: { type: DataTypes.STRING(160), allowNull: false },
    rule_key: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    description: DataTypes.TEXT,
    category: {
      type: DataTypes.ENUM(
        'sql_injection', 'xss', 'command_injection', 'path_traversal', 'file_attack',
        'bad_bot', 'scanner', 'brute_force', 'spam', 'cms_probe', 'custom'
      ),
      allowNull: false,
      defaultValue: 'custom'
    },
    pattern: { type: DataTypes.TEXT, allowNull: false },
    pattern_type: {
      type: DataTypes.ENUM('regex', 'contains', 'equals'),
      allowNull: false,
      defaultValue: 'regex'
    },
    target: {
      type: DataTypes.ENUM('url', 'query', 'body', 'headers', 'user_agent', 'ip', 'file_name', 'all'),
      allowNull: false,
      defaultValue: 'all'
    },
    action: {
      type: DataTypes.ENUM('log', 'block', 'rate_limit', 'temporary_block', 'challenge'),
      allowNull: false,
      defaultValue: 'block'
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium'
    },
    status: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10 },
    created_by: DataTypes.INTEGER.UNSIGNED
  }, {
    tableName: 'waf_rules',
    paranoid: true,
    deletedAt: 'deleted_at'
  });
