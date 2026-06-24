const express = require('express');
const { body } = require('express-validator');
const site = require('../controllers/public/siteController');

const router = express.Router();

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
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('subject').trim().notEmpty(),
    body('message').trim().notEmpty()
  ],
  site.submitContact
);
router.post('/post/:id/comment', site.comment);
router.get('/sitemap.xml', site.sitemap);
router.get('/robots.txt', site.robots);

module.exports = router;
