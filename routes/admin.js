const express = require('express');
const { body } = require('express-validator');
const { requireAuth, guestOnly } = require('../middleware/auth');
const { can } = require('../middleware/permission');
const { loginLimiter } = require('../middleware/security');
const { activityLogMiddleware } = require('../middleware/activityLog');
const upload = require('../middleware/upload');

const auth = require('../controllers/admin/authController');
const dashboard = require('../controllers/admin/dashboardController');
const crud = require('../controllers/admin/crudController');
const media = require('../controllers/admin/mediaController');
const settings = require('../controllers/admin/settingsController');
const security = require('../controllers/admin/securityController');

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

router.use(requireAuth, activityLogMiddleware('admin'));

router.get('/', requireAuth, can('view_dashboard'), dashboard.dashboard);

router.get('/media', requireAuth, can('manage_media'), media.index);
router.post('/media/upload', requireAuth, can('manage_media'), upload.array('files', 20), media.upload);
router.delete('/media/:id', requireAuth, can('manage_media'), media.destroy);

router.get('/settings', requireAuth, can('manage_settings'), settings.settings);
router.put('/settings', requireAuth, can('manage_settings'), settings.updateSettings);
router.get('/themes', requireAuth, can('manage_themes'), settings.themes);
router.post('/themes/activate', requireAuth, can('manage_themes'), settings.activateTheme);
router.put('/theme-settings', requireAuth, can('manage_themes'), settings.updateThemeSettings);

router.get('/security', requireAuth, can('manage_security'), security.index);
router.put('/security/settings', requireAuth, can('manage_security'), security.updateSettings);
router.get('/security/login-attempts', requireAuth, can('manage_security'), security.index);
router.post('/security/block-ip', requireAuth, can('manage_security'), security.blockIp);
router.delete('/security/unblock-ip/:id', requireAuth, can('manage_security'), security.unblockIp);
router.post('/security/backup-database', requireAuth, can('manage_security'), security.backupDatabase);

function resourcePermission(req, res, next) {
  try {
    const config = crud.configs[req.params.resource];
    return can(config.permission)(req, res, next);
  } catch (error) {
    return next(error);
  }
}

router.get('/:resource', requireAuth, resourcePermission, crud.index);
router.get('/:resource/create', requireAuth, resourcePermission, crud.create);
router.post('/:resource', requireAuth, resourcePermission, upload.image.single('featured_image_file'), crud.store);
router.get('/:resource/:id/edit', requireAuth, resourcePermission, crud.edit);
router.put('/:resource/:id', requireAuth, resourcePermission, upload.image.single('featured_image_file'), crud.update);
router.delete('/:resource/:id', requireAuth, resourcePermission, crud.destroy);

module.exports = router;
