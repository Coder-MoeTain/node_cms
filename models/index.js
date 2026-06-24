const sequelize = require('../config/database');

const Role = require('./Role')(sequelize);
const Permission = require('./Permission')(sequelize);
const User = require('./User')(sequelize);
const Category = require('./Category')(sequelize);
const Tag = require('./Tag')(sequelize);
const Post = require('./Post')(sequelize);
const Page = require('./Page')(sequelize);
const Media = require('./Media')(sequelize);
const Menu = require('./Menu')(sequelize);
const MenuItem = require('./MenuItem')(sequelize);
const Banner = require('./Banner')(sequelize);
const Slider = require('./Slider')(sequelize);
const Theme = require('./Theme')(sequelize);
const ThemeSetting = require('./ThemeSetting')(sequelize);
const SiteSetting = require('./SiteSetting')(sequelize);
const Comment = require('./Comment')(sequelize);
const ContactMessage = require('./ContactMessage')(sequelize);
const SecuritySetting = require('./SecuritySetting')(sequelize);
const LoginAttempt = require('./LoginAttempt')(sequelize);
const BlockedIp = require('./BlockedIp')(sequelize);
const ActivityLog = require('./ActivityLog')(sequelize);
const Plugin = require('./Plugin')(sequelize);
const PluginSetting = require('./PluginSetting')(sequelize);
const PluginHook = require('./PluginHook')(sequelize);
const PluginMigration = require('./PluginMigration')(sequelize);
const PasswordResetToken = require('./PasswordResetToken')(sequelize);
const TwoFactorRecoveryCode = require('./TwoFactorRecoveryCode')(sequelize);
const WafRule = require('./WafRule')(sequelize);
const WafLog = require('./WafLog')(sequelize);
const WafIpList = require('./WafIpList')(sequelize);
const WafSetting = require('./WafSetting')(sequelize);
const WafRateLimit = require('./WafRateLimit')(sequelize);

Role.belongsToMany(Permission, { through: 'role_permissions', foreignKey: 'role_id', otherKey: 'permission_id' });
Permission.belongsToMany(Role, { through: 'role_permissions', foreignKey: 'permission_id', otherKey: 'role_id' });

Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });

Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });
Category.hasMany(Post, { foreignKey: 'category_id' });
Post.belongsTo(Category, { foreignKey: 'category_id' });

User.hasMany(Post, { foreignKey: 'author_id', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
User.hasMany(Page, { foreignKey: 'author_id', as: 'pages' });
Page.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

Post.belongsToMany(Tag, { through: 'post_tags', foreignKey: 'post_id', otherKey: 'tag_id' });
Tag.belongsToMany(Post, { through: 'post_tags', foreignKey: 'tag_id', otherKey: 'post_id' });

User.hasMany(Media, { foreignKey: 'uploaded_by' });
Media.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

Menu.hasMany(MenuItem, { foreignKey: 'menu_id', as: 'items' });
MenuItem.belongsTo(Menu, { foreignKey: 'menu_id' });
MenuItem.hasMany(MenuItem, { foreignKey: 'parent_id', as: 'children' });
MenuItem.belongsTo(MenuItem, { foreignKey: 'parent_id', as: 'parent' });

Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'post_id' });
Comment.hasMany(Comment, { foreignKey: 'parent_id', as: 'replies' });

User.hasMany(ActivityLog, { foreignKey: 'user_id' });
ActivityLog.belongsTo(User, { foreignKey: 'user_id' });

WafRule.hasMany(WafLog, { foreignKey: 'matched_rule_id' });
WafLog.belongsTo(WafRule, { foreignKey: 'matched_rule_id' });
User.hasMany(WafLog, { foreignKey: 'user_id' });
WafLog.belongsTo(User, { foreignKey: 'user_id' });

Plugin.hasMany(PluginSetting, { foreignKey: 'plugin_id', as: 'settings' });
PluginSetting.belongsTo(Plugin, { foreignKey: 'plugin_id' });
Plugin.hasMany(PluginHook, { foreignKey: 'plugin_id', as: 'hooks' });
PluginHook.belongsTo(Plugin, { foreignKey: 'plugin_id' });
Plugin.hasMany(PluginMigration, { foreignKey: 'plugin_id', as: 'migrations' });
PluginMigration.belongsTo(Plugin, { foreignKey: 'plugin_id' });
User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetTokens' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(TwoFactorRecoveryCode, { foreignKey: 'user_id', as: 'twoFactorRecoveryCodes' });
TwoFactorRecoveryCode.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  sequelize,
  Role,
  Permission,
  User,
  Category,
  Tag,
  Post,
  Page,
  Media,
  Menu,
  MenuItem,
  Banner,
  Slider,
  Theme,
  ThemeSetting,
  SiteSetting,
  Comment,
  ContactMessage,
  SecuritySetting,
  LoginAttempt,
  BlockedIp,
  ActivityLog,
  Plugin,
  PluginSetting,
  PluginHook,
  PluginMigration,
  PasswordResetToken,
  TwoFactorRecoveryCode,
  WafRule,
  WafLog,
  WafIpList,
  WafSetting,
  WafRateLimit
};
