const express = require('express');
const { body } = require('express-validator');
const { requireAuth, guestOnly } = require('../middleware/auth');
const { can, canAny, policy } = require('../middleware/permission');
const { loginLimiter } = require('../middleware/security');
const { activityLogMiddleware } = require('../middleware/activityLog');
const upload = require('../middleware/upload');
const { zipUpload } = require('../middleware/zipUpload');

const crudImageUpload = upload.image.fields([
  { name: 'featured_image_file', maxCount: 1 },
  { name: 'image_file', maxCount: 1 }
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
const settings = require('../controllers/admin/settingsController');
const security = require('../controllers/admin/securityController');
const database = require('../controllers/admin/databaseController');
const waf = require('../controllers/admin/wafController');

const router = express.Router();

router.get('/login', guestOnly, auth.loginForm);
router.post('/login', loginLimiter, guestOnly, [body('email').isEmail().withMessage('Valid email is required.'), body('password').notEmpty().withMessage('Password is required.')], auth.login);
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

router.use(requireAuth, activityLogMiddleware('admin'));

router.get('/', requireAuth, can('view_dashboard'), dashboard.dashboard);
router.post('/quick-draft', requireAuth, canAny(['manage_posts', 'create_posts']), dashboard.quickDraft);

router.get('/media', requireAuth, canAny(['manage_media', 'upload_media']), media.index);
router.post('/media/upload', requireAuth, canAny(['manage_media', 'upload_media']), upload.array('files', 20), media.upload);
router.get('/media/:id/edit', requireAuth, canAny(['manage_media', 'upload_media']), media.edit);
router.put('/media/:id', requireAuth, canAny(['manage_media', 'upload_media']), upload.single('file'), media.update);
router.delete('/media/:id', requireAuth, canAny(['manage_media', 'upload_media']), media.destroy);

router.get('/plugins', requireAuth, can('manage_plugins'), plugins.index);
router.post('/plugins/upload', requireAuth, can('manage_plugins'), zipUpload.single('archive'), plugins.upload);
router.post('/plugins/:slug/activate', requireAuth, can('manage_plugins'), plugins.activate);
router.post('/plugins/:slug/deactivate', requireAuth, can('manage_plugins'), plugins.deactivate);
router.post('/plugins/:slug/uninstall', requireAuth, can('manage_plugins'), plugins.uninstall);
router.get('/plugins/:slug/settings', requireAuth, can('manage_plugins'), plugins.settings);
router.put('/plugins/:slug/settings', requireAuth, can('manage_plugins'), plugins.updateSettings);

router.get('/settings/media-gallery', requireAuth, can('manage_settings'), settings.mediaGallery);
router.get('/settings/database', requireAuth, canAny(['manage_settings', 'manage_security']), database.index);
router.post('/settings/database/backup', requireAuth, canAny(['manage_settings', 'manage_security']), database.createBackup);
router.post('/settings/database/restore/:filename', requireAuth, canAny(['manage_settings', 'manage_security']), database.restoreBackup);
router.delete('/settings/database/backup/:filename', requireAuth, canAny(['manage_settings', 'manage_security']), database.destroyBackup);
router.post('/settings/database/reset', requireAuth, canAny(['manage_settings', 'manage_security']), database.resetDatabase);
router.get('/settings', requireAuth, can('manage_settings'), settings.settings);
router.put('/settings', requireAuth, can('manage_settings'), brandingImageUpload, settings.updateSettings);
router.get('/themes', requireAuth, can('manage_themes'), settings.themes);
router.post('/themes/upload', requireAuth, can('manage_themes'), zipUpload.single('archive'), settings.uploadTheme);
router.post('/themes/:slug/uninstall', requireAuth, can('manage_themes'), settings.uninstallTheme);
router.get('/themes/customize', requireAuth, can('manage_themes'), settings.themeEditor);
router.get('/themes/editor', requireAuth, can('manage_themes'), (req, res) => res.redirect('/admin/themes/customize'));
router.post('/themes/activate', requireAuth, can('manage_themes'), settings.activateTheme);
router.put('/theme-settings', requireAuth, can('manage_themes'), brandingImageUpload, settings.updateThemeSettings);

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
router.get('/waf/rules', requireAuth, wafPermission, waf.rules);
router.get('/waf/rules/create', requireAuth, wafPermission, waf.createRule);
router.post('/waf/rules', requireAuth, wafPermission, waf.storeRule);
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
router.post('/:resource', requireAuth, resourcePermission, crudImageUpload, crud.store);
router.get('/:resource/:id/edit', requireAuth, resourcePermission, crud.edit);
router.put('/:resource/:id', requireAuth, resourcePermission, crudImageUpload, crud.update);
router.delete('/:resource/:id', requireAuth, resourcePermission, crud.destroy);

module.exports = router;
