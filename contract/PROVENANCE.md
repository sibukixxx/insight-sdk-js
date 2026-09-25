# Pinned contract provenance

`contract/v1/schema.json` and `contract/v1/fixtures/` are a test snapshot of the upstream Public Engine Contract. They are not authoritative; `sibukixxx/insight` is.

| Field | Value |
|---|---|
| Upstream repository | https://github.com/sibukixxx/insight |
| Upstream path | `contracts/public-engine/v1/` |
| Upstream revision | `c447f9f4ed96bddaba859a64745cfd7a9064357c` (insight `main`, PR #104) |
| Contract version | `1` |
| Synced | 2026-09-25 |

To resync, copy the upstream directory at a new revision, update this table and run `npm run generate` and `npm test`.

## Analytical Artifact v1

`contract/analytical-artifact/v1/` (`schema.json`, `temporal-operation.schema.json` and `fixtures/`) is a test snapshot of insight `contracts/analytical-artifact/v1/` at revision `c447f9f4ed96bddaba859a64745cfd7a9064357c` (insight `main`, PR #104, 2026-09-25). Module `analytical` validates every pinned fixture.
