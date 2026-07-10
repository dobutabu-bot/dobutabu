# Deployment Recovery Report

Date: 2026-07-10

## Goal

Produce the shortest safe path to a working public HTTPS Railway deployment for Buro Finans Paneli V3-RC2.

## Result

**Railway deployment files are prepared. Public URL was not generated from this machine because Railway CLI is not installed/authenticated and `npx @railway/cli --version` did not complete in the current environment.**

This is not treated as an application-code failure. The repository is ready to be pushed to GitHub and deployed through Railway UI.

## Selected Deployment Strategy

Prisma datasource provider is `sqlite`, so the urgent Railway path is:

- SQLite database on Railway persistent volume.
- `DATABASE_URL=file:/data/buro-finans.db`
- Private document storage on the same persistent volume.
- `DOCUMENT_STORAGE_DIR=/data/documents`
- Single replica only.
- No PostgreSQL conversion in this recovery pass.

See `docs/DEPLOYMENT_DECISION.md`.

## Prepared Files

- `Dockerfile`
- `.dockerignore`
- `railway.toml`
- `scripts/railway-start.sh`
- `scripts/start-production.mjs`
- `.env.railway.example`
- `docs/DEPLOYMENT_DECISION.md`
- `docs/RAILWAY_DEPLOY.md`
- `docs/RAILWAY_ENV_VALUES.md`

## Local Verification

| Command | Result | Note |
|---|---|---|
| `npm ci` | PASS | Dependencies installed locally. |
| `npx prisma generate` | BLOCKED | Current machine cannot update Prisma engine cache and cannot reach `binaries.prisma.sh`. Railway remote build has network access and should run this during build. |
| `npm run typecheck` | BLOCKED | Blocked by incomplete Prisma client after local generate failure. |
| `npm run lint` | PASS | ESLint completed successfully. |
| `npm run build` | BLOCKED | Blocked at `prisma generate` for the same local cache/network reason. |
| `railway --version` | BLOCKED | Railway CLI is not installed. |
| `npx @railway/cli --version` | BLOCKED | Command did not complete in the current network/runtime environment. |

## Railway UI Short Path

1. Push branch `deployment-rescue` to GitHub.
2. Railway -> New Project -> Deploy from GitHub repo -> select branch `deployment-rescue`.
3. Add persistent volume to app service with mount path `/data`.
4. Add env variables from `docs/RAILWAY_ENV_VALUES.md`.
5. Deploy.
6. Settings -> Networking -> Generate Domain.
7. Set `APP_URL` to the generated HTTPS domain and redeploy.
8. Check:

```bash
curl https://PUBLIC_DOMAIN/api/health
open https://PUBLIC_DOMAIN/login
```

## Expected Public Health Response

```json
{
  "ok": true,
  "app": "buro-finans-paneli",
  "version": "V3-RC2",
  "env": "production",
  "database": "ok",
  "storage": "ok",
  "time": "ISO_DATE"
}
```

## Public URL Status

`PENDING`: A Railway authenticated deploy is still required. Do not mark this deployment as LIVE until Railway produces a public HTTPS domain and `/api/health` returns `ok: true`.

## Latest Blocker

Railway CLI is unavailable in this Codex runtime, and Git metadata writes are restricted in the current sandbox. The prepared files must be committed and pushed from the user's local terminal or from an environment with GitHub/Railway authentication.
