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
const TranslationCache = require('./TranslationCache')(sequelize);
const CustomPostType = require('./CustomPostType')(sequelize);
const FieldGroup = require('./FieldGroup')(sequelize);
const CustomField = require('./CustomField')(sequelize);
const CustomFieldValue = require('./CustomFieldValue')(sequelize);
const Revision = require('./Revision')(sequelize);
const Autosave = require('./Autosave')(sequelize);
const ContentTranslation = require('./ContentTranslation')(sequelize);
const WidgetArea = require('./WidgetArea')(sequelize);
const WidgetInstance = require('./WidgetInstance')(sequelize);
const SiteTemplate = require('./SiteTemplate')(sequelize);
const TemplatePart = require('./TemplatePart')(sequelize);
const ImportJob = require('./ImportJob')(sequelize);
const UpdateLog = require('./UpdateLog')(sequelize);
const Site = require('./Site')(sequelize);
const SiteDomain = require('./SiteDomain')(sequelize);
const SiteUser = require('./SiteUser')(sequelize);
const NetworkSiteSetting = require('./NetworkSiteSetting')(sequelize);
const SlugRedirect = require('./SlugRedirect')(sequelize);
const Taxonomy = require('./Taxonomy')(sequelize);
const TaxonomyTerm = require('./TaxonomyTerm')(sequelize);
const PostTaxonomyTerm = require('./PostTaxonomyTerm')(sequelize);
const TrafficLog = require('./TrafficLog')(sequelize);

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
Page.belongsTo(Page, { foreignKey: 'parent_id', as: 'parent' });
Page.hasMany(Page, { foreignKey: 'parent_id', as: 'children' });

Post.belongsToMany(Tag, { through: 'post_tags', foreignKey: 'post_id', otherKey: 'tag_id' });
Tag.belongsToMany(Post, { through: 'post_tags', foreignKey: 'tag_id', otherKey: 'post_id' });

Taxonomy.hasMany(TaxonomyTerm, { foreignKey: 'taxonomy_id', as: 'terms' });
TaxonomyTerm.belongsTo(Taxonomy, { foreignKey: 'taxonomy_id', as: 'taxonomy' });
TaxonomyTerm.hasMany(TaxonomyTerm, { foreignKey: 'parent_id', as: 'children' });
TaxonomyTerm.belongsTo(TaxonomyTerm, { foreignKey: 'parent_id', as: 'parent' });
Post.belongsToMany(TaxonomyTerm, { through: PostTaxonomyTerm, foreignKey: 'post_id', otherKey: 'term_id', as: 'taxonomyTerms' });
TaxonomyTerm.belongsToMany(Post, { through: PostTaxonomyTerm, foreignKey: 'term_id', otherKey: 'post_id', as: 'posts' });

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

FieldGroup.hasMany(CustomField, { foreignKey: 'field_group_id', as: 'fields' });
CustomField.belongsTo(FieldGroup, { foreignKey: 'field_group_id' });
CustomField.hasMany(CustomFieldValue, { foreignKey: 'custom_field_id', as: 'values' });
CustomFieldValue.belongsTo(CustomField, { foreignKey: 'custom_field_id' });
User.hasMany(Revision, { foreignKey: 'created_by', as: 'revisions' });
Revision.belongsTo(User, { foreignKey: 'created_by', as: 'author' });

WidgetArea.hasMany(WidgetInstance, { foreignKey: 'widget_area_id', as: 'widgets' });
WidgetInstance.belongsTo(WidgetArea, { foreignKey: 'widget_area_id' });
Site.hasMany(SiteDomain, { foreignKey: 'site_id', as: 'domains' });
SiteDomain.belongsTo(Site, { foreignKey: 'site_id' });
Site.hasMany(SiteUser, { foreignKey: 'site_id', as: 'members' });
SiteUser.belongsTo(Site, { foreignKey: 'site_id' });
SiteUser.belongsTo(User, { foreignKey: 'user_id' });
Site.hasMany(NetworkSiteSetting, { foreignKey: 'site_id', as: 'settings' });
Site.hasMany(Post, { foreignKey: 'site_id', as: 'posts' });
Site.hasMany(Page, { foreignKey: 'site_id', as: 'pages' });
Site.hasMany(Category, { foreignKey: 'site_id', as: 'categories' });
Site.hasMany(Menu, { foreignKey: 'site_id', as: 'menus' });
Site.hasMany(Media, { foreignKey: 'site_id', as: 'media' });
Site.hasMany(Tag, { foreignKey: 'site_id', as: 'tags' });
Site.hasMany(WidgetArea, { foreignKey: 'site_id', as: 'widgetAreas' });
Site.hasMany(CustomPostType, { foreignKey: 'site_id', as: 'customPostTypes' });
Site.hasMany(Taxonomy, { foreignKey: 'site_id', as: 'taxonomies' });
Site.hasMany(Comment, { foreignKey: 'site_id', as: 'comments' });
Site.hasMany(FieldGroup, { foreignKey: 'site_id', as: 'fieldGroups' });
Site.hasMany(Banner, { foreignKey: 'site_id', as: 'banners' });
Site.hasMany(Slider, { foreignKey: 'site_id', as: 'sliders' });
Site.hasMany(SiteSetting, { foreignKey: 'site_id', as: 'siteSettings' });
Site.hasMany(TaxonomyTerm, { foreignKey: 'site_id', as: 'taxonomyTerms' });
Site.hasMany(WidgetInstance, { foreignKey: 'site_id', as: 'widgetInstances' });
Post.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Page.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Category.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Menu.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Media.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Tag.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
WidgetArea.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
CustomPostType.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Taxonomy.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Comment.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
FieldGroup.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Banner.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Slider.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
SiteSetting.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
TaxonomyTerm.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
WidgetInstance.belongsTo(Site, { foreignKey: 'site_id', as: 'site' });
Comment.belongsTo(Comment, { foreignKey: 'parent_id', as: 'parent' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });

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
  WafRateLimit,
  TranslationCache,
  CustomPostType,
  FieldGroup,
  CustomField,
  CustomFieldValue,
  Revision,
  Autosave,
  WidgetArea,
  WidgetInstance,
  SiteTemplate,
  TemplatePart,
  ImportJob,
  UpdateLog,
  Site,
  SiteDomain,
  SiteUser,
  NetworkSiteSetting,
  ContentTranslation,
  SlugRedirect,
  Taxonomy,
  TaxonomyTerm,
  PostTaxonomyTerm,
  TrafficLog
};
