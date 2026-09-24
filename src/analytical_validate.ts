// Validation rules mirror the Go SDK (insight-sdk-go/analytical) and the
// public v1 contract.
import {
  ANALYTICAL_SCHEMA, ANALYTICAL_VERSION, InvalidAnalyticalArtifactError,
} from "./analytical_types.ts";
import type { AnalyticalArtifact, Hash, Period, TemporalMetadata } from "./analytical_types.ts";

const blank = (s: unknown): boolean => typeof s !== "string" || s.trim() === "";

function checkHash(name: string, h: Hash | undefined): void {
  if (!h || h.algorithm?.trim() !== "sha256") throw new InvalidAnalyticalArtifactError(`${name}.algorithm must be sha256`);
  const v = (h.value ?? "").trim();
  if (!/^[0-9A-Fa-f]{64}$/.test(v)) throw new InvalidAnalyticalArtifactError(`${name}.value must contain 64 hexadecimal characters`);
}

function checkPeriod(name: string, p: Period | undefined): void {
  if (!p || blank(p.start) || blank(p.end)) throw new InvalidAnalyticalArtifactError(`${name} requires start and end`);
  if (p.start > p.end) throw new InvalidAnalyticalArtifactError(`${name}.start must not be after end`);
}

function isTimestamp(s: unknown): boolean {
  return typeof s === "string" && s !== "" && !Number.isNaN(Date.parse(s)) && !s.startsWith("0001-01-01");
}

function checkTemporal(name: string, t: TemporalMetadata): void {
  if (!isTimestamp(t.observedAt) || blank(t.geography)) throw new InvalidAnalyticalArtifactError(`${name}: observedAt and geography are required`);
  if (t.origin !== "observed" && t.origin !== "derived") throw new InvalidAnalyticalArtifactError(`${name}: origin "${t.origin}" must be observed or derived`);
  if (!["nominal", "real", "not_applicable"].includes(t.valueBasis)) throw new InvalidAnalyticalArtifactError(`${name}: valueBasis "${t.valueBasis}" is not supported`);
}

const isScalar = (v: unknown): boolean =>
  v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/** Throws InvalidAnalyticalArtifactError when a violates the v1 contract. */
export function validateAnalyticalArtifact(a: AnalyticalArtifact): void {
  const fail = (m: string): never => { throw new InvalidAnalyticalArtifactError(m); };
  if (a.artifactSchema !== ANALYTICAL_SCHEMA || a.schemaVersion !== ANALYTICAL_VERSION) fail(`unsupported schema "${a.artifactSchema}" version "${a.schemaVersion}"`);
  if (blank(a.id) || blank(a.producer) || blank(a.producerVersion) || !isTimestamp(a.generatedAt)) fail("id, producer, producerVersion and generatedAt are required");
  if (a.externalSubject && (blank(a.externalSubject.namespace) || blank(a.externalSubject.id))) fail("externalSubject requires namespace and id");
  checkHash("artifactHash", a.artifactHash);
  if (!a.datasets?.length) fail("at least one dataset is required");
  const datasetIds = new Set<string>();
  a.datasets.forEach((d, i) => {
    if (blank(d.id) || blank(d.version)) fail(`datasets[${i}] requires id and version`);
    if (datasetIds.has(d.id)) fail(`duplicate dataset id "${d.id}"`);
    datasetIds.add(d.id);
    checkHash(`datasets[${i}].hash`, d.hash);
  });
  if (!a.spec || blank(a.spec.kind) || blank(a.spec.reference)) fail("spec kind and reference are required");
  checkHash("spec.hash", a.spec.hash);
  checkPeriod("period", a.period);
  if (!a.population || blank(a.population.description)) fail("population.description is required");
  if (!a.metrics?.length || !a.results?.length) fail("metrics and results must not be empty");
  const metricIds = new Set<string>();
  a.metrics.forEach((m, i) => {
    if (blank(m.id) || blank(m.name) || blank(m.unit)) fail(`metrics[${i}] requires id, name and unit`);
    if (metricIds.has(m.id)) fail(`duplicate metric id "${m.id}"`);
    metricIds.add(m.id);
  });
  a.results.forEach((r, i) => {
    if (!metricIds.has(r.metricId)) fail(`results[${i}] references unknown metric "${r.metricId}"`);
    checkPeriod(`results[${i}].period`, r.period);
    if (r.temporal) checkTemporal(`results[${i}].temporal`, r.temporal);
    const hasValue = r.value !== undefined;
    if (r.missing && hasValue) fail(`results[${i}] cannot have value when missing`);
    if (!r.missing && (!hasValue || !isScalar(r.value))) fail(`results[${i}].value must be a JSON scalar`);
  });
  const c = a.computation;
  if (!c || blank(c.engine) || blank(c.engineVersion) || c.deterministic !== true) fail("computation requires engine, engineVersion and deterministic=true");
  if (!a.provenance?.length) fail("source provenance is required");
  const covered = new Set<string>();
  a.provenance.forEach((p, i) => {
    if (!datasetIds.has(p.datasetId)) fail(`provenance[${i}] references unknown dataset "${p.datasetId}"`);
    if (blank(p.source) || !isTimestamp(p.retrievedAt)) fail(`provenance[${i}] requires source and retrievedAt`);
    covered.add(p.datasetId);
  });
  for (const id of datasetIds) if (!covered.has(id)) fail(`dataset "${id}" has no source provenance`);
}
