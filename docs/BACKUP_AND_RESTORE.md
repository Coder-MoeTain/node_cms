# Backup And Restore

## Database Backup

```bash
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > backups/nodepress-$(date +%F).sql
```

## Uploads Backup

```bash
tar -czf backups/uploads-$(date +%F).tar.gz public/uploads
```

## Restore Database

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < backups/nodepress-YYYY-MM-DD.sql
```

## Restore Uploads

```bash
tar -xzf backups/uploads-YYYY-MM-DD.tar.gz
```

## Recommended Schedule

- Database: daily.
- Uploads: daily incremental, weekly full archive.
- Verify restores monthly in a staging database.
