#!/usr/bin/env node
/**
 * Clear featured_image / og_image when the referenced file is missing from public/uploads.
 *
 * Usage:
 *   node database/purge-missing-featured-images.js
 *   node database/purge-missing-featured-images.js --dry-run
 */

require('dotenv').config();

const { sequelize, Post, Page } = require('../models');
const { extractUploadsPath, mediaFileExists } = require('../utils/mediaHelper');

function isMissingStoredImage(value) {
  const uploadsPath = extractUploadsPath(value);
  if (!uploadsPath) return false;
  return !mediaFileExists(uploadsPath);
}

async function purgeModel(Model, label) {
  const rows = await Model.findAll();
  let cleared = 0;

  for (const row of rows) {
    const updates = {};
    if (isMissingStoredImage(row.featured_image)) updates.featured_image = null;
    if (isMissingStoredImage(row.og_image)) updates.og_image = null;
    if (!Object.keys(updates).length) continue;
    if (!process.argv.includes('--dry-run')) {
      await row.update(updates);
    }
    cleared += 1;
  }

  console.log(`${label}: cleared ${cleared} of ${rows.length}`);
  return cleared;
}

async function main() {
  await sequelize.authenticate();
  const posts = await purgeModel(Post, 'Posts');
  const pages = await purgeModel(Page, 'Pages');
  if (process.argv.includes('--dry-run')) {
    console.log('Dry run only — no database rows were updated.');
  }
  console.log(`Done. Total rows with missing images: ${posts + pages}`);
}

main()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
