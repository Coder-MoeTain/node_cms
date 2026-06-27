const fs = require('fs');
const path = require('path');
const models = require('../../models');
const policy = require('../../utils/policy');
const { exportSite } = require('../../utils/exporter');
const { previewImport, importSite } = require('../../utils/importer');
const { isWxrDocument, previewWxrImport } = require('../../utils/wxrImporter');
const { exportSiteToWxr } = require('../../utils/wxrExporter');
const { getCurrentSiteId } = require('../../utils/siteScope');
const { exportPostsToCsv, exportPagesToCsv } = require('../../utils/csvExporter');
const { csvToImportPayload, isPostsCsv } = require('../../utils/csvImporter');
const { Post, Page } = require('../../models');
const { Op } = require('sequelize');

async function exportForm(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/tools');
    }
    return res.render('admin/tools/export', { title: 'Export' });
  } catch (error) {
    return next(error);
  }
}

async function exportWxrDownload(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const xml = await exportSiteToWxr(exportSite, {
      includeMedia: req.query.media !== '0',
      siteTitle: res.locals.siteSettings?.site_title || 'NodePress Export',
      siteId: getCurrentSiteId(req)
    });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="nodepress-export-${Date.now()}.wxr.xml"`);
    return res.send(xml);
  } catch (error) {
    return next(error);
  }
}

async function exportDownload(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const data = await exportSite({ includeMedia: req.query.media !== '0', siteId: getCurrentSiteId(req) });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nodepress-export-${Date.now()}.json"`);
    return res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    return next(error);
  }
}

async function importForm(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/tools');
    }
    const jobs = await models.ImportJob.findAll({ order: [['created_at', 'DESC']], limit: 10 });
    return res.render('admin/tools/import', { title: 'Import', jobs, preview: null });
  } catch (error) {
    return next(error);
  }
}

async function exportCsvDownload(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const type = req.query.type === 'pages' ? 'pages' : 'posts';
    const siteId = getCurrentSiteId(req);
    const scope = siteId ? { [Op.or]: [{ site_id: null }, { site_id: siteId }] } : {};
    const rows = type === 'pages'
      ? await Page.findAll({ where: scope, order: [['updated_at', 'DESC']] })
      : await Post.findAll({ where: { ...scope, post_type: 'post' }, order: [['updated_at', 'DESC']] });
    const csv = type === 'pages' ? exportPagesToCsv(rows) : exportPostsToCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nodepress-${type}-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

async function importPreview(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/tools/import');
    }
    if (!req.file) {
      req.flash('error', 'Upload a JSON, CSV, or WordPress WXR export file.');
      return res.redirect('/admin/tools/import');
    }
    const raw = fs.readFileSync(req.file.path, 'utf8');
    fs.unlink(req.file.path, () => {});
    let data;
    let preview;
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (isWxrDocument(raw)) {
      const wxrPreview = await previewWxrImport(raw);
      data = wxrPreview.payload;
      preview = { ...wxrPreview.preview, wxr_items: wxrPreview.itemCount };
    } else if (ext === '.csv' || (ext !== '.json' && isPostsCsv(raw))) {
      data = csvToImportPayload(raw, req.query.type === 'pages' ? 'pages' : 'posts');
      preview = await previewImport(data);
      preview.format = 'csv';
    } else {
      data = JSON.parse(raw);
      preview = await previewImport(data);
    }
    req.session.importPreview = data;
    req.session.importIsWxr = Boolean(isWxrDocument(raw));
    const jobs = await models.ImportJob.findAll({ order: [['created_at', 'DESC']], limit: 10 });
    return res.render('admin/tools/import', { title: 'Import', jobs, preview, importIsWxr: req.session.importIsWxr });
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/tools/import');
  }
}

async function importRun(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/tools/import');
    }
    const data = req.session.importPreview;
    if (!data) {
      req.flash('error', 'No import preview found. Upload a file first.');
      return res.redirect('/admin/tools/import');
    }
    const dryRun = req.body.dry_run === 'on';
    const downloadRemoteMedia = req.body.download_remote_media === 'on' && req.session.importIsWxr;
    const result = await importSite(data, {
      dryRun,
      userId: req.session.user.id,
      downloadRemoteMedia,
      siteId: getCurrentSiteId(req)
    });
    delete req.session.importPreview;
    delete req.session.importIsWxr;
    req.flash('success', dryRun ? 'Dry run completed.' : `Import completed (${result.logs.length} items).`);
    return res.redirect('/admin/tools/import');
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/tools/import');
  }
}

module.exports = { exportForm, exportDownload, exportWxrDownload, exportCsvDownload, importForm, importPreview, importRun };
