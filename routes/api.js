const express = require('express');
const fs = require('fs');
const path = require('path');
const { Post, Page, Category, Tag } = require('../models');

const router = express.Router();
const v1 = require('./api/v1');

router.get('/v1/openapi.yaml', (req, res) => {
  const file = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  res.type('text/yaml').send(fs.readFileSync(file, 'utf8'));
});

router.use('/v1', v1);

router.get('/posts', async (req, res, next) => {
  try {
    const posts = await Post.findAll({
      where: { status: 'published', post_type: 'post' },
      include: [Category, Tag],
      order: [['published_at', 'DESC']]
    });
    res.json(posts);
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ where: { slug: req.params.slug, status: 'published', post_type: 'post' }, include: [Category, Tag] });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    return res.json(post);
  } catch (error) {
    return next(error);
  }
});

router.get('/pages/:slug', async (req, res, next) => {
  try {
    const page = await Page.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!page) return res.status(404).json({ message: 'Page not found' });
    return res.json(page);
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json(await Category.findAll({ order: [['name', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
