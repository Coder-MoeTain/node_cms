# Backup And Restore

NodePress CMS ships CLI backup scripts and an admin backup panel. All automated backups are stored under `database/backups/`.

## NPM Scripts

| Command | Description |
| --- | --- |
| `npm run backup` | One-off mysqldump + optional uploads archive |
| `npm run backup:scheduled` | Timestamped backup with retention pruning |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run migrate:status` | Show migration status |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKUP_RETENTION_DAYS` | `14` | Days to keep scheduled backups |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | from `.env` | Database connection for dumps |
| `SQL_RESTORE_MAX_SIZE_MB` | `100` | Max upload size for SQL restore in admin |

## Manual Database Backup

```bash
npm run backup
```

Or directly:

```bash
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > database/backups/backup-$(date +%F-%H%M%S).sql
```

## Uploads Backup

```bash
tar -czf database/backups/uploads-$(date +%F-%H%M%S).tar.gz public/uploads
```

The `npm run backup` script creates both when `mysqldump` and `tar` are available on the host.

## Scheduled Backups

Add a cron entry on the server:

```cron
0 2 * * * cd /var/www/nodepress-cms && /usr/bin/npm run backup:scheduled >> logs/backup.log 2>&1
```

Or use the **Updraft Backup** plugin widget in Admin → Dashboard for on-demand backups with retention.

## Restore Database

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/backups/backup-YYYY-MM-DD-HHMMSS.sql
```

### Admin UI restore

1. Sign in as an administrator with **Manage Settings** or **Manage Security**.
2. Open **Admin → Settings → Database** (or **Security → Backup**).
3. Choose a backup file from `database/backups/` and confirm restore.

### Admin UI restore from upload

1. Open **Admin → Settings → Database**.
2. Under **Restore from SQL File**, choose a `.sql` dump (max size set by `SQL_RESTORE_MAX_SIZE_MB`, default 100 MB).
3. Confirm the restore prompt. The file is imported via the `mysql` client and then deleted from `tmp/uploads`.

## Restore Uploads

```bash
tar -xzf database/backups/uploads-YYYY-MM-DD-HHMMSS.tar.gz
```

## Recommended Schedule

- Database: daily (`backup:scheduled`).
- Uploads: daily incremental, weekly full archive.
- Verify restores monthly in a staging database.
- Copy backups off-site (rsync, S3, or object storage) for disaster recovery.

## Docker note

The production Docker image does not include `mysqldump`. Run backups from the host or a sidecar container with the MySQL client tools installed.
