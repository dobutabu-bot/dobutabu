# Railway Deploy Guide

Goal: deploy the existing Buro Finans Paneli V3-RC2 app to a working HTTPS Railway URL without changing V1/V2/V3 features.

## 1. Push the deployment branch

```bash
git checkout -b deployment-rescue
git add package.json package-lock.json Dockerfile .dockerignore railway.toml scripts/start-production.mjs scripts/railway-start.sh .env.railway.example docs/DEPLOYMENT_DECISION.md docs/RAILWAY_DEPLOY.md docs/RAILWAY_ENV_VALUES.md
git commit -m "chore: prepare Railway deployment rescue"
git push -u origin deployment-rescue
```

If the branch already exists, use:

```bash
git checkout deployment-rescue
git push -u origin deployment-rescue
```

## 2. Create Railway project

1. Open Railway.
2. Choose **New Project**.
3. Select **Deploy from GitHub repo**.
4. Select the repository and branch `deployment-rescue`.
5. Railway should detect the Dockerfile.

## 3. Add persistent volume

In the app service:

1. Open **Volumes**.
2. Add a persistent volume.
3. Mount path:

```text
/data
```

This is required for:

- SQLite database: `/data/buro-finans.db`
- Private documents: `/data/documents`

## 4. Add environment variables

Use `docs/RAILWAY_ENV_VALUES.md`.

Minimum required values:

```text
NODE_ENV=production
APP_ENV=production
DATABASE_URL=file:/data/buro-finans.db
DOCUMENT_STORAGE_DIR=/data/documents
AUTH_SECRET=<openssl rand -base64 48>
SESSION_SECRET=<openssl rand -base64 48>
APP_URL=https://TEMPORARY-RAILWAY-DOMAIN
```

Generate secrets locally:

```bash
openssl rand -base64 48
```

## 5. Deploy

Railway start command is defined in `railway.toml`:

```bash
sh scripts/railway-start.sh
```

Startup order:

1. Create `/data/documents`.
2. Run `npx prisma migrate deploy`.
3. Run `npm run start`.

## 6. Generate public domain

1. Open the app service.
2. Go to **Settings -> Networking**.
3. Click **Generate Domain**.
4. Copy the HTTPS URL.
5. Set `APP_URL` to that exact HTTPS URL.
6. Redeploy.

## 7. Smoke check

Replace `PUBLIC_DOMAIN` with the Railway URL:

```bash
curl https://PUBLIC_DOMAIN/api/health
open https://PUBLIC_DOMAIN/login
```

Expected health response shape:

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

## Known constraints

- SQLite on Railway volume is single-replica only.
- Do not enable horizontal scaling for this emergency deployment.
- For long-term production scale, migrate to PostgreSQL and external private object storage.
