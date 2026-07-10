# Railway Environment Values

Do not paste real secrets into this file. Add them in Railway UI.

| Variable | Required | Railway value |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `APP_ENV` | Yes | `production` |
| `APP_URL` | Yes | Railway generated HTTPS domain, for example `https://PROJECT.up.railway.app` |
| `DATABASE_URL` | Yes | `file:/data/buro-finans.db` |
| `AUTH_SECRET` | Yes | Generate locally with `openssl rand -base64 48` |
| `SESSION_SECRET` | Yes | Same strength as `AUTH_SECRET`, preferably a different generated value |
| `DOCUMENT_STORAGE_DIR` | Yes | `/data/documents` |
| `DOCUMENT_MAX_UPLOAD_SIZE_MB` | Optional | `20` |
| `ADMIN_EMAIL` | Optional | Change from demo value before real production use |
| `ADMIN_PASSWORD` | Optional | Change from demo value before real production use |
| `TRUST_PROXY` | Optional | `true` |
| `PORT` | No | Railway injects this automatically |

## Required Railway Volume

Add a persistent volume to the app service and mount it at:

```text
/data
```

SQLite database and private document files both live under this volume.
