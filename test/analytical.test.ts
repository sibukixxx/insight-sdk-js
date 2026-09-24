import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { analytical } from "../src/index.ts";
import type { AnalyticalArtifact } from "../src/analytical.ts";

const fixtureDir = new URL("../contract/analytical-artifact/v1/fixtures/", import.meta.url);
const readJSON = (u: URL) => JSON.parse(readFileSync(u, "utf8"));

function validArtifact(): AnalyticalArtifact {
  const at = "2026-09-01T00:00:00Z";
  return analytical.sealAnalyticalArtifact({
    artifactSchema: "", schemaVersion: "", artifactHash: { algorithm: "", value: "" },
    id: "a-1", producer: "p", producerVersion: "1", generatedAt: at,
    datasets: [{ id: "ds", version: "v1", hash: analytical.sha256Hash("rows") }],
    spec: { kind: "declarative", reference: "spec.json", hash: analytical.sha256Hash("spec") },
    period: { start: "2026-01", end: "2026-06" }, population: { description: "rows" },
    metrics: [{ id: "m", name: "M", unit: "count" }],
    results: [{ metricId: "m", period: { start: "2026-01", end: "2026-06" }, value: 3 }],
    computation: { engine: "e", engineVersion: "1", deterministic: true },
    provenance: [{ datasetId: "ds", source: "urn:x", retrievedAt: at }],
  });
}

test("every pinned public Analytical Artifact fixture validates", () => {
  const files = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 3);
  for (const f of files) analytical.validateAnalyticalArtifact(readJSON(new URL(f, fixtureDir)));
});

test("sealing reproduces the artifactHash computed by the Go SDK", () => {
  const vector = readJSON(new URL("./fixtures/seal-vector.json", import.meta.url));
  const resealed = analytical.sealAnalyticalArtifact(vector.artifact);
  assert.equal(resealed.artifactHash.value, vector.artifactHash.value);
});

test("sealing is stable for the same content and changes with content", () => {
  const a = validArtifact();
  const b = validArtifact();
  assert.equal(a.artifactHash.value, b.artifactHash.value);
  const c = analytical.sealAnalyticalArtifact({ ...b, population: { description: "changed" } });
  assert.notEqual(c.artifactHash.value, a.artifactHash.value);
});

const invalid: Array<[string, (a: AnalyticalArtifact) => void]> = [
  ["value on a missing result", (a) => { a.results[0]!.missing = true; }],
  ["missing value on a non-missing result", (a) => { delete a.results[0]!.value; }],
  ["non-scalar value", (a) => { (a.results[0] as any).value = { x: 1 }; }],
  ["unknown metric", (a) => { a.results[0]!.metricId = "nope"; }],
  ["dataset without provenance", (a) => { a.datasets.push({ id: "other", version: "1", hash: analytical.sha256Hash("x") }); }],
  ["duplicate metric id", (a) => { a.metrics.push({ id: "m", name: "M2", unit: "u" }); }],
  ["bad hash", (a) => { a.spec.hash = { algorithm: "sha256", value: "zz" }; }],
  ["period start after end", (a) => { a.period = { start: "2026-06", end: "2026-01" }; }],
  ["non-deterministic computation", (a) => { a.computation.deterministic = false; }],
  ["bad temporal origin", (a) => { a.results[0]!.temporal = { observedAt: "2026-01-01T00:00:00Z", origin: "guessed" as any, geography: "JP", valueBasis: "real" }; }],
  ["unsupported schema", (a) => { a.schemaVersion = "2"; }],
];

for (const [name, mutate] of invalid) {
  test(`validation rejects ${name}`, () => {
    const a = structuredClone(validArtifact());
    mutate(a);
    assert.throws(() => analytical.validateAnalyticalArtifact(a), analytical.InvalidAnalyticalArtifactError);
  });
}

test("checkDuplicate treats same id and hash as duplicate and different hash as conflict", () => {
  const a = validArtifact();
  assert.equal(analytical.checkDuplicate(a, validArtifact()), true);
  const changed = analytical.sealAnalyticalArtifact({ ...a, population: { description: "changed" } });
  assert.throws(() => analytical.checkDuplicate(a, changed), analytical.AnalyticalIdentityConflictError);
  assert.equal(analytical.checkDuplicate(a, { ...changed, id: "other" }), false);
});
