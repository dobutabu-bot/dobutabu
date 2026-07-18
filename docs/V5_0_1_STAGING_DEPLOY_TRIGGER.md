# V5.0.1 Staging Deployment Trigger

- Scope: staging only
- Production: untouched
- Rollback baseline: `4cc1b06`
- Previous hotfix head verified by GitHub quality gates: `7d8a7206f974ef6b1efe878918cc8ef7fb869d22`
- GitHub Actions result: PASS
- Railway staging `Wait for CI` was disabled only after the complete GitHub Actions matrix passed, because the Railway GitHub permission bridge did not consume the successful check suite for the already-merged pull request.
- This documentation commit intentionally triggers a fresh staging deployment from the current hotfix branch.

Production deployment remains frozen until staging browser-download and critical-route regression tests pass.
