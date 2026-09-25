# Pinned contract provenance

`contract/v1/schema.json` and `contract/v1/fixtures/` are a test snapshot of the upstream Public Engine Contract. They are not authoritative; `sibukixxx/insight` is.

| Field | Value |
|---|---|
| Upstream repository | https://github.com/sibukixxx/insight |
| Upstream path | `contracts/public-engine/v1/` |
| Upstream revision | `e4a455ec80c5f2cb934b8f369a561a4c14e22d9b` (insight `main`; `contracts/` last changed at `51bc77908689f728c38b2555105bf5f24c329791`, PRs #108/#111/#112/#114 — the same contract as the insight-sdk-go v0.6 pin `51bc779`) |
| Contract version | `1` |
| Synced | 2026-09-25 |

To resync, copy the upstream directory at a new revision, update this table and run `npm run generate` and `npm test`.

## Analytical Artifact v1

`contract/analytical-artifact/v1/` (`schema.json`, `temporal-operation.schema.json` and `fixtures/`) is a test snapshot of insight `contracts/analytical-artifact/v1/` at revision `e4a455ec80c5f2cb934b8f369a561a4c14e22d9b` (insight `main`, 2026-09-25; unchanged since PR #104). Module `analytical` validates every pinned fixture.
