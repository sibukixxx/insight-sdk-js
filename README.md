# insight-sdk-js

Thin TypeScript client (`@sibukixxx/insight-sdk`) for the [Insight](https://github.com/sibukixxx/insight) **Public Engine Contract v1**.

`sibukixxx/insight` owns Research semantics and the Public Contract. This SDK holds no research logic and no domain policy; it is optional — the engine is fully usable over its HTTP contract alone.

```text
consumer
   ↓
insight-sdk-js        (this repository)
   ↓
Public Engine Contract (insight: contracts/public-engine/v1)
   ↓
insight OSS
```

## Usage

```ts
import { InsightClient, InsightError } from "@sibukixxx/insight-sdk";

const client = new InsightClient({ baseUrl: "http://127.0.0.1:8787", timeoutMs: 30_000 });
const subject = await client.createSubject({ idempotencyKey: "my-subject", subject: { namespace: "my-app", id: "item-42" } });
// addEvidence -> startAnalysis -> waitForAnalysis -> getAnalysisResults
// createResearchRun -> appendIteration -> getResearchRun
```

Example: `node example/minimal.ts http://127.0.0.1:8787` (Node >= 22.18 runs the erasable TypeScript directly).

- Every method accepts `{ signal }` for aborts, combined with the client timeout.
- Failures throw `InsightError` with a contract `code` and `httpStatus`. `UNAVAILABLE` means the engine could not be reached.
- `contractVersion` and a random `idempotencyKey` are filled in when omitted. Reuse your own key on retry.
- `fetch` can be injected (`new InsightClient({ fetch })`) to use a different transport.

## Compatibility

| SDK version | Contract versions | Pinned contract source |
|---|---|---|
| 0.2.x | `1` (adds InputSource, ExecutionProfile, run comparison, re-evaluation, timeline, temporal operations, scenarios, data triage) | `contract/v1` — see [contract/PROVENANCE.md](contract/PROVENANCE.md) |
| 0.1.x | `1` (original v0 surface) | insight `e6e402d` |

Unknown response fields are ignored; a different `contractVersion` fails with `UNSUPPORTED_CONTRACT_VERSION`. 0.2.0 added InputSource / RawArtifact (insight #90, #4) and ExecutionProfile (insight #91, #5) additively; every 0.1 call keeps working. Requests with an idempotency key get `contractVersion` and a random `idempotencyKey` filled in; stateless requests (e.g. `applyTemporalOperation`) get only `contractVersion`.

## Development

| Script | Purpose |
|---|---|
| `npm run generate` | Regenerate `src/contract.gen.ts` from the pinned `contract/v1/schema.json` |
| `npm run check-generated` | Fail if the generated types are stale |
| `npm run typecheck` | Type-check with `tsc` |
| `npm test` | Unit, drift and (with `INSIGHT_DETERMINISTIC_URL` / `INSIGHT_MODEL_BACKED_URL`) live conformance tests. Fixtures 08/09 need the engine started with `-input-root contract/v1/fixtures/data -heavy-dir <dir>` |
| `npm run build` | Emit `dist/` (not committed) for packaging |

Not published to npm yet.

## License

Apache-2.0
