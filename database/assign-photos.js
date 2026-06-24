#!/usr/bin/env node
/**
 * Copy images from photos/ into public/uploads/photo-pool/ and assign a random
 * image to every post and page (featured_image + og_image).
 *
 * Usage:
 *   node database/assign-photos.js
 *   node database/assign-photos.js --only-missing
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { sequelize, Post, Page } = require('../models');

const PHOTOS_SRC = path.join(__dirname, '../photos');
const UPLOAD_DEST = path.join(__dirname, '../public/uploads/photo-pool');
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

function parseArgs() {
  return { onlyMissing: process.argv.includes('--only-missing') };
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

function listSourceImages() {
  if (!fs.existsSync(PHOTOS_SRC)) {
    throw new Error(`Photos folder not found: ${PHOTOS_SRC}`);
  }
  return fs
    .readdirSync(PHOTOS_SRC)
    .filter((file) => IMAGE_RE.test(file))
    .map((file) => path.join(PHOTOS_SRC, file));
}

function buildPhotoPool() {
  const sources = listSourceImages();
  if (!sources.length) {
    throw new Error('No images found in photos/');
  }

  fs.mkdirSync(UPLOAD_DEST, { recursive: true });
  const urls = [];
  const usedNames = new Set();

  for (const src of sources) {
    let baseName = sanitizeFilename(path.basename(src));
    let destName = baseName;
    let counter = 1;

    while (usedNames.has(destName)) {
      const ext = path.extname(baseName);
      const stem = path.basename(baseName, ext);
      destName = `${stem}-${counter}${ext}`;
      counter += 1;
    }

    usedNames.add(destName);
    fs.copyFileSync(src, path.join(UPLOAD_DEST, destName));
    urls.push(`/uploads/photo-pool/${destName}`);
  }

  return urls;
}

function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

async function ensurePageImageColumns() {
  await sequelize.query(
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS featured_image VARCHAR(255) NULL AFTER excerpt'
  );
  await sequelize.query(
    'ALTER TABLE pages ADD COLUMN IF NOT EXISTS og_image VARCHAR(255) NULL AFTER seo_description'
  );
}

async function assignPhotos({ onlyMissing }) {
  await sequelize.authenticate();
  await ensurePageImageColumns();

  const pool = buildPhotoPool();
  console.log(`Photo pool ready: ${pool.length} images in /uploads/photo-pool/`);

  const posts = await Post.findAll();
  let postUpdates = 0;

  for (const post of posts) {
    if (onlyMissing && post.featured_image) continue;
    const image = pickRandom(pool);
    await post.update({ featured_image: image, og_image: image });
    postUpdates += 1;
  }

  const pages = await Page.findAll();
  let pageUpdates = 0;

  for (const page of pages) {
    if (onlyMissing && page.featured_image) continue;
    const image = pickRandom(pool);
    await page.update({ featured_image: image, og_image: image });
    pageUpdates += 1;
  }

  console.log(`Updated ${postUpdates} of ${posts.length} posts`);
  console.log(`Updated ${pageUpdates} of ${pages.length} pages`);
}

const opts = parseArgs();

assignPhotos(opts)
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
