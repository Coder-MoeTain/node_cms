const express = require('express');
const { body } = require('express-validator');
const appConfig = require('../config/app');
const { requireAuth, guestOnly } = require('../middleware/auth');
const { can, canAny, policy } = require('../middleware/permission');
const { loginBruteForceGuard, conditionalLoginLimiter } = require('../middleware/loginBruteForce');
const { activityLogMiddleware } = require('../middleware/activityLog');
const upload = require('../middleware/upload');
const { zipUpload } = require('../middleware/zipUpload');
const { jsonUpload } = require('../middleware/jsonUpload');
const { sqlUpload } = require('../middleware/sqlUpload');

const crudImageUpload = upload.image.fields([
  { name: 'featured_image_file', maxCount: 1 },
  { name: 'image_file', maxCount: 1 },
  { name: 'image_file_2', maxCount: 1 },
  { name: 'image_file_3', maxCount: 1 }
]);

const brandingImageUpload = upload.image.fields([
  { name: 'site_logo_file', maxCount: 1 },
  { name: 'favicon_file', maxCount: 1 },
  { name: 'logo_file', maxCount: 1 }
]);

const auth = require('../controllers/admin/authController');
const dashboard = require('../controllers/admin/dashboardController');
const crud = require('../controllers/admin/crudController');
const media = require('../controllers/admin/mediaController');
const plugins = require('../controllers/admin/pluginController');
const loginSessions = require('../controllers/admin/loginSessionsController');
const settings = require('../controllers/admin/settingsController');
const themes = require('../controllers/admin/themeController');
const security = require('../controllers/admin/securityController');
const database = require('../controllers/admin/databaseController');
const waf = require('../controllers/admin/wafController');
const customPostTypes = require('../controllers/admin/customPostTypeController');
const customContent = require('../controllers/admin/customContentController');
const fieldGroups = require('../controllers/admin/fieldGroupController');
const revisions = require('../controllers/admin/revisionController');
const tools = require('../controllers/admin/toolsController');
const widgets = require('../controllers/admin/widgetController');
const importExport = require('../controllers/admin/importExportController');
const updates = require('../controllers/admin/updateController');
const templates = require('../controllers/admin/templateController');
const network = require('../controllers/admin/networkController');
const autosave = require('../controllers/admin/autosaveController');
const comments = require('../controllers/admin/commentController');
const translation = require('../controllers/admin/translationController');

const router = express.Router();

function handleImageUpload(req, res, next) {
  upload.image.single('file')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Upload failed.' });
    next();
  });
}

function handleMediaUpload(req, res, next) {
  upload.array('files', appConfig.mediaUploadMaxFiles)(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_COUNT') {
        req.flash('error', `You can upload up to ${appConfig.mediaUploadMaxFiles} files at once.`);
      } else {
        req.flash('error', error.message || 'Upload failed.');
      }
      return res.redirect('/admin/media');
    }
    return next();
  });
}

function handleSqlUpload(req, res, next) {
  sqlUpload.single('sql_file')(req, res, (error) => {
    if (error) {
      req.flash('error', error.message || 'SQL upload failed.');
      return res.redirect('/admin/settings/database');
    }
    return next();
  });
}

router.get('/login', guestOnly, auth.loginForm);
router.post('/login', conditionalLoginLimiter, loginBruteForceGuard, guestOnly, [body('email').isEmail().withMessage('Valid email is required.'), body('password').notEmpty().withMessage('Password is required.')], auth.login);
router.post('/logout', requireAuth, auth.logout);
router.get('/forgot-password', guestOnly, auth.forgotPasswordForm);
router.post('/forgot-password', guestOnly, auth.forgotPassword);
router.get('/reset-password', guestOnly, auth.resetPasswordForm);
router.post('/reset-password', guestOnly, auth.resetPassword);
router.get('/profile', requireAuth, auth.profile);
router.put('/profile', requireAuth, auth.updateProfile);
router.get('/profile/2fa', requireAuth, auth.twoFactorForm);
router.post('/profile/2fa/enable', requireAuth, auth.enableTwoFactor);
router.post('/profile/2fa/disable', requireAuth, auth.disableTwoFactor);
router.get('/profile/2fa/recovery-codes', requireAuth, auth.recoveryCodesView);

router.use(requireAuth, activityLogMiddleware('admin'));

router.get('/', requireAuth, can('view_dashboard'), dashboard.dashboard);
router.post('/quick-draft', requireAuth, canAny(['manage_posts', 'create_posts']), dashboard.quickDraft);

router.get('/media', requireAuth, canAny(['manage_media', 'upload_media']), media.index);
router.get('/media/gallery', requireAuth, canAny(['manage_media', 'upload_media']), media.gallery);
router.post('/media/upload', requireAuth, canAny(['manage_media', 'upload_media']), handleMediaUpload, media.upload);
router.post('/media/upload-json', requireAuth, canAny(['manage_media', 'upload_media']), handleImageUpload, media.uploadJson);
router.get('/media/:id/edit', requireAuth, canAny(['manage_media', 'upload_media']), media.edit);
router.put('/media/:id', requireAuth, canAny(['manage_media', 'upload_media']), upload.single('file'), media.update);
router.delete('/media/:id', requireAuth, canAny(['manage_media', 'upload_media']), media.destroy);
router.post('/media/bulk-delete', requireAuth, can('manage_media'), media.bulkDestroy);
router.post('/media/regenerate-thumbnails', requireAuth, can('manage_media'), media.regenerateThumbnails);

router.get('/plugins', requireAuth, can('manage_plugins'), plugins.index);
router.get('/plugins.json', requireAuth, can('manage_plugins'), plugins.pluginsJson);
router.post('/plugins/sync', requireAuth, can('manage_plugins'), plugins.syncPlugins);
router.post('/plugins/bulk', requireAuth, can('manage_plugins'), plugins.bulkAction);
router.post('/plugins/upload', requireAuth, can('manage_plugins'), zipUpload.single('archive'), plugins.upload);
router.get('/plugins/:slug', requireAuth, can('manage_plugins'), plugins.show);
router.post('/plugins/:slug/migrate', requireAuth, can('manage_plugins'), plugins.runMigrations);
router.post('/plugins/:slug/activate', requireAuth, can('manage_plugins'), plugins.activate);
router.post('/plugins/:slug/deactivate', requireAuth, can('manage_plugins'), plugins.deactivate);
router.post('/plugins/:slug/uninstall', requireAuth, can('manage_plugins'), plugins.uninstall);
router.get('/plugins/:slug/settings', requireAuth, can('manage_plugins'), plugins.settings);
router.put('/plugins/:slug/settings', requireAuth, can('manage_plugins'), plugins.updateSettings);

router.get('/settings/login-sessions', requireAuth, canAny(['manage_settings', 'manage_security']), loginSessions.index);
router.post('/settings/login-sessions/revoke', requireAuth, canAny(['manage_settings', 'manage_security']), loginSessions.revoke);
router.get('/settings/media-gallery', requireAuth, canAny(['manage_settings', 'manage_media', 'upload_media']), settings.mediaGallery);
router.get('/settings/database', requireAuth, canAny(['manage_settings', 'manage_security']), database.index);
router.post('/settings/database/backup', requireAuth, canAny(['manage_settings', 'manage_security']), database.createBackup);
router.post('/settings/database/restore/:filename', requireAuth, canAny(['manage_settings', 'manage_security']), database.restoreBackup);
router.post('/settings/database/restore-upload', requireAuth, canAny(['manage_settings', 'manage_security']), handleSqlUpload, database.restoreUpload);
router.delete('/settings/database/backup/:filename', requireAuth, canAny(['manage_settings', 'manage_security']), database.destroyBackup);
router.post('/settings/database/reset', requireAuth, canAny(['manage_settings', 'manage_security']), database.resetDatabase);
router.get('/settings', requireAuth, can('manage_settings'), settings.settings);
router.put('/settings', requireAuth, can('manage_settings'), brandingImageUpload, settings.updateSettings);
router.get('/themes', requireAuth, can('manage_themes'), themes.index);
router.get('/themes.json', requireAuth, can('manage_themes'), themes.themesJson);
router.post('/themes/sync', requireAuth, can('manage_themes'), themes.syncThemes);
router.post('/themes/upload', requireAuth, can('manage_themes'), zipUpload.single('archive'), themes.upload);
router.get('/themes/customize', requireAuth, can('manage_themes'), themes.customize);
router.get('/themes/customize/preview', requireAuth, can('manage_themes'), themes.previewTheme);
router.get('/themes/editor', requireAuth, can('manage_themes'), (req, res) => res.redirect('/admin/themes/customize'));
router.post('/themes/activate', requireAuth, can('manage_themes'), themes.activate);
router.post('/themes/reset', requireAuth, can('manage_themes'), themes.resetSettings);
router.put('/theme-settings', requireAuth, can('manage_themes'), brandingImageUpload, themes.updateSettings);
router.post('/theme-settings/preview', requireAuth, can('manage_themes'), themes.previewDraft);
router.get('/themes/:slug/thumbnail', requireAuth, can('manage_themes'), themes.previewThumbnail);
router.get('/themes/:slug/preview', requireAuth, can('manage_themes'), themes.previewThemeLive);
router.get('/themes/:slug', requireAuth, can('manage_themes'), themes.show);
router.post('/themes/:slug/uninstall', requireAuth, can('manage_themes'), themes.uninstall);

router.get('/security', requireAuth, can('manage_security'), security.index);
router.put('/security/settings', requireAuth, can('manage_security'), security.updateSettings);
router.get('/security/login-attempts', requireAuth, can('manage_security'), security.index);
router.post('/security/block-ip', requireAuth, can('manage_security'), security.blockIp);
router.delete('/security/unblock-ip/:id', requireAuth, can('manage_security'), security.unblockIp);
router.post('/security/backup-database', requireAuth, can('manage_security'), security.backupDatabase);

const wafPermission = canAny(['manage_waf', 'manage_security']);
router.get('/waf', requireAuth, wafPermission, waf.dashboard);
router.get('/waf/settings', requireAuth, wafPermission, waf.settings);
router.post('/waf/settings', requireAuth, wafPermission, waf.updateSettings);
router.post('/waf/models/upload', requireAuth, wafPermission, zipUpload.single('model_archive'), waf.uploadModel);
router.post('/waf/models/:id/activate', requireAuth, wafPermission, waf.activateModelAction);
router.post('/waf/models/:id/delete', requireAuth, wafPermission, waf.deleteModelAction);
router.get('/waf/rules', requireAuth, wafPermission, waf.rules);
router.get('/waf/rules/create', requireAuth, wafPermission, waf.createRule);
router.post('/waf/rules', requireAuth, wafPermission, waf.storeRule);
router.post('/waf/rules/test', requireAuth, wafPermission, waf.testRule);
router.get('/waf/rules/:id/edit', requireAuth, wafPermission, waf.editRule);
router.post('/waf/rules/:id', requireAuth, wafPermission, waf.updateRule);
router.post('/waf/rules/:id/delete', requireAuth, wafPermission, waf.deleteRule);
router.post('/waf/rules/:id/toggle', requireAuth, wafPermission, waf.toggleRule);
router.get('/waf/logs', requireAuth, wafPermission, waf.logs);
router.get('/waf/logs/:id', requireAuth, wafPermission, waf.logDetail);
router.post('/waf/logs/:id/delete', requireAuth, wafPermission, waf.deleteLog);
router.post('/waf/logs/delete-old', requireAuth, wafPermission, waf.deleteOldLogs);
router.get('/waf/logs/export/csv', requireAuth, wafPermission, waf.exportLogsCsv);
router.get('/waf/ip-lists', requireAuth, wafPermission, waf.ipLists);
router.post('/waf/ip-lists', requireAuth, wafPermission, waf.addIpList);
router.post('/waf/ip-lists/:id/delete', requireAuth, wafPermission, waf.removeIpList);
router.post('/waf/logs/:id/block-ip', requireAuth, wafPermission, waf.blockIpFromLog);
router.post('/waf/logs/:id/whitelist-ip', requireAuth, wafPermission, waf.whitelistIpFromLog);

router.get('/custom-post-types', requireAuth, can('manage_custom_post_types'), customPostTypes.index);
router.get('/custom-post-types/create', requireAuth, can('manage_custom_post_types'), customPostTypes.create);
router.post('/custom-post-types', requireAuth, can('manage_custom_post_types'), customPostTypes.store);
router.get('/custom-post-types/:id/edit', requireAuth, can('manage_custom_post_types'), customPostTypes.edit);
router.put('/custom-post-types/:id', requireAuth, can('manage_custom_post_types'), customPostTypes.update);
router.delete('/custom-post-types/:id', requireAuth, can('manage_custom_post_types'), customPostTypes.destroy);

router.get('/content/:typeSlug', requireAuth, canAny(['manage_custom_content', 'manage_posts', 'create_posts', 'edit_posts']), customContent.index);
router.get('/content/:typeSlug/create', requireAuth, canAny(['manage_custom_content', 'create_posts', 'manage_posts']), customContent.create);
router.post('/content/:typeSlug', requireAuth, canAny(['manage_custom_content', 'create_posts', 'manage_posts']), crudImageUpload, customContent.store);
router.get('/content/:typeSlug/:id/edit', requireAuth, canAny(['manage_custom_content', 'manage_posts', 'edit_posts', 'create_posts']), customContent.edit);
router.put('/content/:typeSlug/:id', requireAuth, canAny(['manage_custom_content', 'manage_posts', 'edit_posts', 'create_posts']), crudImageUpload, customContent.update);
router.delete('/content/:typeSlug/:id', requireAuth, canAny(['manage_custom_content', 'delete_posts', 'manage_posts']), customContent.destroy);

router.get('/field-groups', requireAuth, can('manage_custom_fields'), fieldGroups.index);
router.get('/field-groups/create', requireAuth, can('manage_custom_fields'), fieldGroups.create);
router.post('/field-groups', requireAuth, can('manage_custom_fields'), fieldGroups.store);
router.get('/field-groups/:id/edit', requireAuth, can('manage_custom_fields'), fieldGroups.edit);
router.put('/field-groups/:id', requireAuth, can('manage_custom_fields'), fieldGroups.update);
router.delete('/field-groups/:id', requireAuth, can('manage_custom_fields'), fieldGroups.destroy);

router.get('/revisions', requireAuth, canAny(['manage_posts', 'manage_pages', 'manage_custom_content']), revisions.index);
router.get('/revisions/compare', requireAuth, canAny(['manage_posts', 'manage_pages', 'manage_custom_content']), revisions.compare);
router.post('/revisions/:id/restore', requireAuth, canAny(['manage_posts', 'manage_pages', 'manage_custom_content']), revisions.restore);

router.get('/tools', requireAuth, can('manage_settings'), tools.index);
router.get('/tools/health', requireAuth, canAny(['manage_settings', 'manage_security']), tools.siteHealth);
router.get('/tools/health.json', requireAuth, canAny(['manage_settings', 'manage_security']), tools.siteHealthJson);
router.get('/tools/export', requireAuth, can('manage_settings'), importExport.exportForm);
router.get('/tools/export/download', requireAuth, can('manage_settings'), importExport.exportDownload);
router.get('/tools/import', requireAuth, can('manage_settings'), importExport.importForm);
router.post('/tools/import/preview', requireAuth, can('manage_settings'), jsonUpload.single('file'), importExport.importPreview);
router.post('/tools/import', requireAuth, can('manage_settings'), importExport.importRun);

router.get('/updates', requireAuth, can('manage_settings'), updates.index);
router.post('/updates/check', requireAuth, can('manage_settings'), updates.check);

router.get('/widgets', requireAuth, can('manage_settings'), widgets.index);
router.post('/widgets/seed-defaults', requireAuth, can('manage_settings'), widgets.seedDefaults);
router.get('/widgets/:slug', requireAuth, can('manage_settings'), widgets.editArea);
router.post('/widgets/:slug', requireAuth, can('manage_settings'), widgets.addWidget);
router.put('/widgets/instance/:id', requireAuth, can('manage_settings'), widgets.updateWidget);
router.post('/widgets/instance/:id/reorder', requireAuth, can('manage_settings'), widgets.reorderWidget);
router.delete('/widgets/instance/:id', requireAuth, can('manage_settings'), widgets.deleteWidget);

router.get('/templates', requireAuth, can('manage_themes'), templates.index);
router.post('/templates/defaults', requireAuth, can('manage_themes'), templates.createDefault);
router.get('/templates/:id/edit', requireAuth, can('manage_themes'), templates.edit);
router.put('/templates/:id', requireAuth, can('manage_themes'), templates.update);

router.get('/network', requireAuth, network.index);
router.get('/network/create', requireAuth, network.create);
router.post('/network', requireAuth, network.store);

router.post('/autosave', requireAuth, autosave.store);
router.get('/autosave', requireAuth, autosave.show);
router.delete('/autosave', requireAuth, autosave.destroy);

router.post('/translate-content', requireAuth, translation.translateContent);

router.get('/comments', requireAuth, can('manage_comments'), comments.index);
router.post('/comments/:id/moderate', requireAuth, can('manage_comments'), comments.moderate);
router.get('/comments/:id/reply', requireAuth, can('manage_comments'), comments.reply);
router.post('/comments/:id/reply', requireAuth, can('manage_comments'), comments.storeReply);
router.post('/comments/bulk', requireAuth, can('manage_comments'), comments.bulk);

function resourcePermission(req, res, next) {
  try {
    const actionMap = {
      GET: req.path.endsWith('/create') ? 'create' : req.path.endsWith('/edit') ? 'edit' : 'index',
      POST: req.path.endsWith('/bulk') ? 'bulk' : 'store',
      PUT: 'update',
      DELETE: 'destroy'
    };
    const action = actionMap[req.method] || 'index';
    if (policy.canManageResource(req.session.user, req.params.resource, action)) return next();
    req.flash('error', 'You do not have permission to perform that action.');
    return res.redirect('/admin/profile');
  } catch (error) {
    return next(error);
  }
}

router.get('/:resource', requireAuth, resourcePermission, crud.index);
router.post('/:resource/bulk', requireAuth, resourcePermission, crud.bulkDestroy);
router.get('/:resource/create', requireAuth, resourcePermission, crud.create);
router.post('/:resource/:id/restore', requireAuth, resourcePermission, crud.restore);
router.delete('/:resource/:id/force', requireAuth, resourcePermission, crud.forceDestroy);
router.post('/:resource', requireAuth, resourcePermission, crudImageUpload, crud.store);
router.get('/:resource/:id/edit', requireAuth, resourcePermission, crud.edit);
router.put('/:resource/:id', requireAuth, resourcePermission, crudImageUpload, crud.update);
router.delete('/:resource/:id', requireAuth, resourcePermission, crud.destroy);

module.exports = router;
