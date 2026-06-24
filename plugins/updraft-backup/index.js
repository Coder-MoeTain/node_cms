const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');
const policy = require('../../utils/policy');

function listBackups() {
  const backupDir = path.join(process.cwd(), 'database', 'backups');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((file) => file.startsWith('backup-') && file.endsWith('.sql'))
    .map((file) => {
      const full = path.join(backupDir, file);
      const stats = fs.statSync(full);
      return { file, size: stats.size, created: stats.mtime };
    })
    .sort((a, b) => b.created - a.created);
}

function pruneOldBackups(days, maxBackups) {
  const backupDir = path.join(process.cwd(), 'database', 'backups');
  if (!fs.existsSync(backupDir)) return;
  const files = listBackups();
  if (days > 0) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    for (const backup of files) {
      if (backup.created.getTime() < cutoff) {
        fs.unlinkSync(path.join(backupDir, backup.file));
      }
    }
  }
  const remaining = listBackups();
  if (maxBackups > 0 && remaining.length > maxBackups) {
    remaining.slice(maxBackups).forEach((backup) => {
      fs.unlinkSync(path.join(backupDir, backup.file));
    });
  }
}

function runBackup(includeUploads, includePlugins) {
  const backupDir = path.join(process.cwd(), 'database', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbFile = path.join(backupDir, `backup-${stamp}.sql`);
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'nodepress_cms';
  const cmd = `mysqldump -h ${host} -P ${port} -u ${user} ${password ? `-p${password}` : ''} ${database}`;
  execSync(`${cmd} > "${dbFile}"`, { stdio: 'pipe', shell: true });

  if (includeUploads) {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      execSync(`tar -czf "${path.join(backupDir, `uploads-${stamp}.tar.gz`)}" -C "${path.dirname(uploadsDir)}" uploads`, { stdio: 'pipe', shell: true });
    }
  }
  if (includePlugins) {
    const pluginsDir = path.join(process.cwd(), 'plugins');
    if (fs.existsSync(pluginsDir)) {
      execSync(`tar -czf "${path.join(backupDir, `plugins-${stamp}.tar.gz`)}" -C "${process.cwd()}" plugins`, { stdio: 'pipe', shell: true });
    }
  }
  return dbFile;
}

module.exports = {
  async register({ app, hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const includeUploads = settingBool(settings.include_uploads, true);
    const includePlugins = settingBool(settings.include_plugins, false);
    const retentionDays = Number(settingValue(settings, 'retention_days', '14'));
    const maxBackups = Number(settingValue(settings, 'max_backups', '10'));
    const scheduleNote = settingValue(settings, 'schedule_note', 'Manual backups via dashboard');

    if (app) {
      app.post('/admin/plugins/updraft-backup/run', async (req, res) => {
        try {
          if (!req.session?.user || !policy.hasPermission(req.session.user, 'manage_plugins')) {
            req.flash('error', 'You do not have permission to run backups.');
            return res.redirect('/admin/plugins');
          }
          runBackup(includeUploads, includePlugins);
          pruneOldBackups(retentionDays, maxBackups);
          req.flash('success', 'Backup completed successfully.');
        } catch (error) {
          req.flash('error', `Backup failed: ${error.message}`);
        }
        return res.redirect('/admin/plugins');
      });
    }

    hooks.register('dashboardWidgets', ({ req }) => {
      const backups = listBackups();
      const latest = backups[0];
      const latestLabel = latest
        ? `${latest.file} (${Math.round(latest.size / 1024)} KB)`
        : 'No backups yet';
      const csrf = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
      return {
        title: 'Site Backup',
        body: `<p class="mb-1"><small>${scheduleNote}</small></p><p class="mb-2">Latest: <code>${latestLabel}</code></p><form method="post" action="/admin/plugins/updraft-backup/run"><input type="hidden" name="_csrf" value="${csrf}"><button type="submit" class="np-btn np-btn-small np-btn-primary">Run backup now</button></form>`
      };
    });
  }
};
