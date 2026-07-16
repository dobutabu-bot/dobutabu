# Release Safety Rules

## Production data

- Never reset, seed, replace, or delete the production database or document volume.
- Never commit `.env` files, SQLite databases, storage contents, backups, tokens, or runtime logs.
- Keep PDF report routes authenticated and private (`Cache-Control: private, no-store`).

## PDF release gate

- A PDF test must verify more than HTTP 200: require `application/pdf`, an attachment filename, `%PDF-` signature, a meaningful byte size, and successful text parsing.
- Browser coverage must observe the real download event in Chromium, Firefox, WebKit/Safari, and a mobile profile.
- Every generated PDF route belongs to the release matrix. Do not use placeholder IDs or skip a failing route.
- The production container must include a Unicode TTF font and validate its readable runtime path.
- Do not deploy while any critical PDF, authentication, database, storage, or browser-download check fails.

## Deployment

- Create and verify database and document-storage backups before production deployment.
- Keep an immutable rollback commit/tag and a documented rollback procedure.
- Verify health, data counts, storage manifest, all PDF routes, and browser downloads after deployment.
