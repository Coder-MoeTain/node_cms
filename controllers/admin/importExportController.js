const fs = require('fs');
const path = require('path');
const models = require('../../models');
const policy = require('../../utils/policy');
const { exportSite } = require('../../utils/exporter');
const { previewImport, importSite } = require('../../utils/importer');

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

async function exportDownload(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const data = await exportSite({ includeMedia: req.query.media !== '0' });
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

async function importPreview(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/tools/import');
    }
    if (!req.file) {
      req.flash('error', 'Upload a JSON export file.');
      return res.redirect('/admin/tools/import');
    }
    const raw = fs.readFileSync(req.file.path, 'utf8');
    fs.unlink(req.file.path, () => {});
    const data = JSON.parse(raw);
    const preview = await previewImport(data);
    req.session.importPreview = data;
    const jobs = await models.ImportJob.findAll({ order: [['created_at', 'DESC']], limit: 10 });
    return res.render('admin/tools/import', { title: 'Import', jobs, preview });
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
    const result = await importSite(data, { dryRun, userId: req.session.user.id });
    delete req.session.importPreview;
    req.flash('success', dryRun ? 'Dry run completed.' : `Import completed (${result.logs.length} items).`);
    return res.redirect('/admin/tools/import');
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/tools/import');
  }
}

module.exports = { exportForm, exportDownload, importForm, importPreview, importRun };
