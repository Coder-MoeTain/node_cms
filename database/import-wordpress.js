#!/usr/bin/env node
/**
 * Import posts, pages, and categories from a WordPress MariaDB/MySQL dump
 * into NodePress CMS.
 *
 * Usage:
 *   node database/import-wordpress.js --sql="path/to/dump.sql"
 *   node database/import-wordpress.js --staging-db=msa_mm_import
 *
 * Options:
 *   --sql=PATH           Import dump into a temporary staging database first
 *   --staging-db=NAME    Read from an already-imported staging database (default: msa_mm_import)
 *   --replace            Clear existing posts, pages, and categories before import
 *   --dry-run            Print counts only; do not write to NodePress
 *   --site-url=URL       Base URL for featured images (default: http://msa.gov.mm)
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const { Transform } = require('stream');
const path = require('path');
const mysql = require('mysql2/promise');
const { sequelize, Category, Post, Page, User } = require('../models');

const STAGING_DB = 'msa_mm_import';
const DEFAULT_SITE_URL = 'http://msa.gov.mm';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    sql: null,
    stagingDb: STAGING_DB,
    replace: false,
    dryRun: false,
    siteUrl: DEFAULT_SITE_URL
  };

  for (const arg of args) {
    if (arg === '--replace') opts.replace = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--sql=')) opts.sql = arg.slice(6).replace(/^["']|["']$/g, '');
    else if (arg.startsWith('--staging-db=')) opts.stagingDb = arg.slice(13);
    else if (arg.startsWith('--site-url=')) opts.siteUrl = arg.slice(11).replace(/\/$/, '');
    else if (arg === '--help' || arg === '-h') {
      console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(0, 16).join('\n'));
      process.exit(0);
    }
  }

  return opts;
}

function mysqlBin() {
  return process.env.MYSQL_BIN || (process.platform === 'win32' ? 'C:\\xampp\\mysql\\bin\\mysql.exe' : 'mysql');
}

function dbConfig(database) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: true
  };
}

async function ensureStagingDatabase(stagingDb) {
  const conn = await mysql.createConnection({
    host: dbConfig().host,
    port: dbConfig().port,
    user: dbConfig().user,
    password: dbConfig().password,
    multipleStatements: true
  });
  try {
    await conn.query('SET GLOBAL max_allowed_packet = 1073741824');
  } catch (_) {
    /* ignore if user lacks SUPER privilege; client flag may still help */
  }
  await conn.query(`DROP DATABASE IF EXISTS \`${stagingDb}\``);
  await conn.query(`CREATE DATABASE \`${stagingDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
}

function importSqlDump(sqlPath, stagingDb) {
  return new Promise(async (resolve, reject) => {
    try {
      const resolved = path.resolve(sqlPath);
      console.log(`Importing WordPress dump into staging database "${stagingDb}"...`);
      console.log(`  File: ${resolved}`);

      await ensureStagingDatabase(stagingDb);

      const bin = mysqlBin();
      const args = [
        `--host=${dbConfig().host}`,
        `--port=${String(dbConfig().port)}`,
        `--user=${dbConfig().user}`,
        ...(dbConfig().password ? [`--password=${dbConfig().password}`] : []),
        '--binary-mode',
        '--force',
        '--max_allowed_packet=512M',
        stagingDb
      ];

      const importer = spawn(bin, args, { stdio: ['pipe', 'inherit', 'inherit'], shell: false });
      let headerStripped = false;
      const stripMariaDbSandboxHeader = new Transform({
        transform(chunk, _enc, cb) {
          let data = chunk.toString('utf8');
          if (!headerStripped) {
            data = data.replace(/^\/\*M!999999\\-[^\r\n]*[\r\n]+?/, '');
            headerStripped = true;
          }
          cb(null, data);
        }
      });

      const stream = fs.createReadStream(resolved, { encoding: 'utf8' });

      importer.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') reject(err);
      });

      importer.on('error', reject);
      importer.on('close', (code) => {
        if (code === 0) {
          console.log('Staging import complete.\n');
          resolve();
          return;
        }

        mysql.createConnection(dbConfig(stagingDb))
          .then(async (conn) => {
            const [[row]] = await conn.query(
              "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'wp_posts'",
              [stagingDb]
            );
            await conn.end();
            if (Number(row.count) > 0) {
              console.warn(`Staging import finished with warnings (exit ${code}); required WordPress tables are present.\n`);
              resolve();
            } else {
              reject(new Error(`Failed to import SQL dump into staging database (exit ${code}).`));
            }
          })
          .catch(() => reject(new Error(`Failed to import SQL dump into staging database (exit ${code}).`)));
      });

      stream.on('error', reject);
      stream.pipe(stripMariaDbSandboxHeader).pipe(importer.stdin);
    } catch (err) {
      reject(err);
    }
  });
}

function decodeSlug(slug) {
  if (!slug) return slug;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(slug)) {
      return decodeURIComponent(slug);
    }
  } catch (_) {
    /* keep original */
  }
  return slug;
}

function resolveSlug(source, fallback) {
  const decoded = decodeSlug(source);
  const trimmed = (decoded || '').trim();
  if (trimmed) {
    return trimmed.slice(0, 240);
  }
  return fallback;
}

async function resolveUniqueSlug(model, source, fallback) {
  const base = resolveSlug(source, fallback);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await model.findOne({ where: { slug: candidate }, paranoid: false });
    if (!existing) return candidate;
    candidate = `${base.slice(0, 220)}-${suffix}`;
    suffix += 1;
  }
}

function mapStatus(wpStatus) {
  switch (wpStatus) {
    case 'publish':
      return 'published';
    case 'draft':
    case 'pending':
      return 'draft';
    case 'private':
      return 'private';
    case 'future':
      return 'scheduled';
    default:
      return null;
  }
}

function truncate(value, max) {
  if (!value) return value;
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const str = String(value);
  if (str.startsWith('0000-00-00')) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function loadStagingData(stagingDb) {
  const conn = await mysql.createConnection(dbConfig(stagingDb));

  const [categories] = await conn.query(`
    SELECT t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
    FROM wp_terms t
    INNER JOIN wp_term_taxonomy tt ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'category'
    ORDER BY tt.parent ASC, t.term_id ASC
  `);

  const [posts] = await conn.query(`
    SELECT ID, post_author, post_date, post_modified, post_content, post_title,
           post_excerpt, post_status, post_name, comment_status, comment_count
    FROM wp_posts
    WHERE post_type = 'post'
      AND post_status IN ('publish', 'draft', 'private', 'future')
    ORDER BY ID ASC
  `);

  const [pages] = await conn.query(`
    SELECT ID, post_author, post_date, post_modified, post_content, post_title,
           post_excerpt, post_status, post_name, comment_status
    FROM wp_posts
    WHERE post_type = 'page'
      AND post_status IN ('publish', 'draft', 'private', 'future')
    ORDER BY ID ASC
  `);

  const [relationships] = await conn.query(`
    SELECT tr.object_id, tr.term_taxonomy_id, tt.term_id, tt.taxonomy
    FROM wp_term_relationships tr
    INNER JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
    WHERE tt.taxonomy = 'category'
  `);

  const [thumbnails] = await conn.query(`
    SELECT pm.post_id, pm.meta_value AS attachment_id
    FROM wp_postmeta pm
    WHERE pm.meta_key = '_thumbnail_id'
      AND pm.meta_value <> ''
  `);

  const [attachments] = await conn.query(`
    SELECT p.ID, p.guid, pm.meta_value AS attached_file
    FROM wp_posts p
    LEFT JOIN wp_postmeta pm ON pm.post_id = p.ID AND pm.meta_key = '_wp_attached_file'
    WHERE p.post_type = 'attachment'
  `);

  await conn.end();

  const categoryByObject = new Map();
  for (const row of relationships) {
    if (!categoryByObject.has(row.object_id)) {
      categoryByObject.set(row.object_id, row.term_id);
    }
  }

  const attachmentMap = new Map();
  for (const row of attachments) {
    attachmentMap.set(Number(row.ID), {
      guid: row.guid,
      file: row.attached_file
    });
  }

  const thumbnailMap = new Map();
  for (const row of thumbnails) {
    thumbnailMap.set(Number(row.post_id), Number(row.meta_value));
  }

  return { categories, posts, pages, categoryByObject, attachmentMap, thumbnailMap };
}

function resolveFeaturedImage(postId, { thumbnailMap, attachmentMap }, siteUrl) {
  const attachmentId = thumbnailMap.get(Number(postId));
  if (!attachmentId) return null;

  const attachment = attachmentMap.get(attachmentId);
  if (!attachment) return null;

  if (attachment.guid) return attachment.guid;
  if (attachment.file) {
    return `${siteUrl}/wp-content/uploads/${attachment.file}`;
  }
  return null;
}

async function clearExistingContent() {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.query('DELETE FROM post_tags');
  await sequelize.query('DELETE FROM comments');
  await Post.destroy({ where: {}, force: true });
  await Page.destroy({ where: {}, force: true });
  await Category.destroy({ where: {}, force: true });
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function importCategories(categories, dryRun) {
  const termToCategoryId = new Map();
  let imported = 0;

  const pending = [...categories];
  const maxPasses = pending.length + 5;
  let pass = 0;

  while (pending.length && pass < maxPasses) {
    pass += 1;
    const remaining = [];

    for (const cat of pending) {
      const parentWpId = Number(cat.parent);
      let parentId = null;

      if (parentWpId > 0) {
        parentId = termToCategoryId.get(parentWpId);
        if (!parentId) {
          remaining.push(cat);
          continue;
        }
      }

      if (dryRun) {
        termToCategoryId.set(Number(cat.term_id), Number(cat.term_id));
        imported += 1;
        continue;
      }

      const uniqueSlug = await resolveUniqueSlug(Category, cat.slug, `category-${cat.term_id}`);

      const created = await Category.create({
        name: truncate(cat.name, 160),
        slug: truncate(uniqueSlug, 180),
        description: cat.description || null,
        parent_id: parentId
      });

      termToCategoryId.set(Number(cat.term_id), created.id);
      imported += 1;
    }

    if (remaining.length === pending.length) {
      console.warn(`Warning: ${remaining.length} categories could not be linked to parents; importing at root level.`);
      for (const cat of remaining) {
        if (dryRun) {
          termToCategoryId.set(Number(cat.term_id), Number(cat.term_id));
          imported += 1;
          continue;
        }

        const uniqueSlug = await resolveUniqueSlug(Category, cat.slug, `category-${cat.term_id}`);
        const created = await Category.create({
          name: truncate(cat.name, 160),
          slug: truncate(uniqueSlug, 180),
          description: cat.description || null,
          parent_id: null
        });
        termToCategoryId.set(Number(cat.term_id), created.id);
        imported += 1;
      }
      break;
    }

    pending.length = 0;
    pending.push(...remaining);
  }

  return { termToCategoryId, imported };
}

async function importPosts(posts, context, authorId, dryRun) {
  let imported = 0;
  let skipped = 0;

  for (const row of posts) {
    const status = mapStatus(row.post_status);
    if (!status) {
      skipped += 1;
      continue;
    }

    const title = truncate((row.post_title || '').trim() || `Post ${row.ID}`, 220);
    const content = (row.post_content || '').trim() || (row.post_excerpt || '').trim() || '<p></p>';
    const slugSource = decodeSlug(row.post_name) || title;
    const categoryWpId = context.categoryByObject.get(Number(row.ID));
    const categoryId = categoryWpId ? context.termToCategoryId.get(Number(categoryWpId)) || null : null;
    const featuredImage = resolveFeaturedImage(row.ID, context, context.siteUrl);
    const publishedAt = status === 'published' || status === 'scheduled' ? normalizeDate(row.post_date) : null;
    const createdAt = normalizeDate(row.post_date) || new Date();
    const updatedAt = normalizeDate(row.post_modified) || createdAt;

    if (dryRun) {
      imported += 1;
      continue;
    }

    const uniqueSlug = await resolveUniqueSlug(Post, slugSource, `post-${row.ID}`);

    await Post.create({
      title,
      slug: truncate(uniqueSlug, 240),
      content,
      excerpt: row.post_excerpt || null,
      featured_image: featuredImage,
      status,
      category_id: categoryId,
      author_id: authorId,
      allow_comments: row.comment_status !== 'closed',
      views_count: 0,
      published_at: publishedAt,
      created_at: createdAt,
      updated_at: updatedAt
    });

    imported += 1;
  }

  return { imported, skipped };
}

async function importPages(pages, context, authorId, dryRun) {
  let imported = 0;
  let skipped = 0;

  for (const row of pages) {
    const status = mapStatus(row.post_status);
    if (!status) {
      skipped += 1;
      continue;
    }

    const title = truncate((row.post_title || '').trim() || `Page ${row.ID}`, 220);
    const content = (row.post_content || '').trim() || (row.post_excerpt || '').trim() || '<p></p>';
    const slugSource = decodeSlug(row.post_name) || title;
    const publishedAt = status === 'published' ? normalizeDate(row.post_date) : null;
    const createdAt = normalizeDate(row.post_date) || new Date();
    const updatedAt = normalizeDate(row.post_modified) || createdAt;

    if (dryRun) {
      imported += 1;
      continue;
    }

    const uniqueSlug = await resolveUniqueSlug(Page, slugSource, `page-${row.ID}`);

    await Page.create({
      title,
      slug: truncate(uniqueSlug, 240),
      content,
      excerpt: row.post_excerpt || null,
      status,
      author_id: authorId,
      published_at: publishedAt,
      created_at: createdAt,
      updated_at: updatedAt
    });

    imported += 1;
  }

  return { imported, skipped };
}

async function main() {
  const opts = parseArgs();

  if (opts.sql) {
    await importSqlDump(opts.sql, opts.stagingDb);
  } else {
    console.log(`Using existing staging database "${opts.stagingDb}".`);
    console.log('Pass --sql=PATH to import a dump first.\n');
  }

  console.log('Loading WordPress data from staging...');
  const staging = await loadStagingData(opts.stagingDb);
  console.log(`  Categories: ${staging.categories.length}`);
  console.log(`  Posts:      ${staging.posts.length}`);
  console.log(`  Pages:      ${staging.pages.length}\n`);

  if (opts.dryRun) {
    console.log('Dry run — no changes written to NodePress.');
    process.exit(0);
  }

  await sequelize.authenticate();

  const admin = await User.findOne({ order: [['id', 'ASC']] });
  if (!admin) {
    throw new Error('No users found in NodePress. Run `npm run seed` first.');
  }

  if (opts.replace) {
    console.log('Clearing existing posts, pages, and categories...');
    await clearExistingContent();
  }

  console.log('Importing categories...');
  const { termToCategoryId, imported: categoryCount } = await importCategories(staging.categories, false);
  console.log(`  Imported ${categoryCount} categories.`);

  const context = {
    ...staging,
    termToCategoryId,
    siteUrl: opts.siteUrl
  };

  console.log('Importing posts...');
  const postResult = await importPosts(staging.posts, context, admin.id, false);
  console.log(`  Imported ${postResult.imported} posts (${postResult.skipped} skipped).`);

  console.log('Importing pages...');
  const pageResult = await importPages(staging.pages, context, admin.id, false);
  console.log(`  Imported ${pageResult.imported} pages (${pageResult.skipped} skipped).`);

  console.log('\nWordPress import complete.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
