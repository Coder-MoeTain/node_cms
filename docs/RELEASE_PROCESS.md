# NodePress Release Process

## Version bump checklist

1. Update `package.json` version (semver).
2. Add a dated section to `CHANGELOG.md` with Added/Changed/Fixed/Security entries.
3. Run the full verification suite:

```bash
npm ci
npm run lint
npm run test:ci
npm audit --audit-level=high
npm run migrate:status
npm run health
```

4. Commit with message: `Release vX.Y.Z`.
5. Create an annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
6. Push branch and tag: `git push && git push origin vX.Y.Z`.

## CI and deploy

- Pushing a `v*` tag triggers `.github/workflows/deploy.yml` (when configured with deploy secrets).
- Deploy must not run if CI fails on the release commit.
- Production deploy health checks must pass (`/health`, `/ready`, `/version`).

## Rollback

1. Redeploy the previous tag or restore from backup (see `docs/BACKUP_AND_RESTORE.md`).
2. Run `npm run migrate:status` — roll forward with a fix migration if schema changed.
3. Document the incident in CHANGELOG under the next patch release.

## Migration notes

- Always run `npm run migrate` before starting the app on production.
- Include migration filenames and purpose in CHANGELOG for operator visibility.
