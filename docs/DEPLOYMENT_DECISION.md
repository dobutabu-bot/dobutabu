# Deployment Decision

Date: 2026-07-10

## Selected Path

**SQLite on Railway persistent volume.**

The current Prisma datasource is:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

For the urgent public deployment, the schema provider and migration history are not changed. A PostgreSQL migration is intentionally deferred because it would be a data-model migration and is outside the recovery scope.

## Railway Runtime Values

- `DATABASE_URL=file:/data/buro-finans.db`
- `DOCUMENT_STORAGE_DIR=/data/documents`
- Railway persistent volume mount path: `/data`
- App replicas: single replica only
- Horizontal scaling: disabled

## Why

- Fastest safe path to a working HTTPS public URL.
- Avoids rewriting Prisma migrations.
- Keeps private documents out of `public/`.
- Preserves the V1/V2/V3 application code and data model.

## Operational Notes

This is acceptable for a single-user emergency production/staging deployment. Before broader multi-user or high-availability usage, move to PostgreSQL and an external private object storage service.
