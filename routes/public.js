const express = require('express');
const { body } = require('express-validator');
const { publicMutationLimiter } = require('../middleware/security');
const site = require('../controllers/public/siteController');
const customContent = require('../controllers/public/customContentController');

const router = express.Router();

router.get('/types/:typeSlug', customContent.archive);
router.get('/types/:typeSlug/:itemSlug', customContent.single);

router.get('/', site.home);
router.get('/blog', site.blog);
router.get('/post/:slug', site.post);
router.get('/category/:slug', site.category);
router.get('/tag/:slug', site.tag);
router.get('/page/:slug', site.page);
router.get('/search', site.search);
router.get('/contact', site.contact);
router.post(
  '/contact',
  publicMutationLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
    body('subject').trim().isLength({ min: 2, max: 180 }),
    body('message').trim().isLength({ min: 5, max: 5000 })
  ],
  site.submitContact
);
router.post(
  '/post/:id/comment',
  publicMutationLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('website').optional({ checkFalsy: true }).trim().isURL({ protocols: ['http', 'https'], require_protocol: true }),
    body('content').trim().isLength({ min: 3, max: 3000 })
  ],
  site.comment
);
router.get('/sitemap.xml', site.sitemap);
router.get('/robots.txt', site.robots);

module.exports = router;
