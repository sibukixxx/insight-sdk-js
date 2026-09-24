// Canonical serialization and sealing, byte-compatible with the Go SDK.
//
// artifactHash = sha256(canonical JSON of the artifact with artifactHash set
// to {"algorithm":"","value":""}). The canonical form is what Go's
// encoding/json produces for insight-sdk-go/analytical.Artifact:
//   - object keys in Go struct field order (not alphabetical), omitempty
//     fields dropped when empty; map values (parameters, filters, result
//     dimensions) with keys sorted, recursively;
//   - strings escaped like Go (<, >, & and U+2028/U+2029 as \uXXXX);
//   - timestamps in RFC 3339 with trailing fractional zeros removed and a
//     zero offset written as "Z" (Go's time.Time RFC3339Nano form);
//   - result.value: omitted only when undefined (null is kept, as Go keeps a
//     json.RawMessage "null");
//   - numbers in ECMAScript formatting, which matches Go for integers and
//     ordinary decimals (write exotic numbers such as 1e21 as strings).
import { createHash } from "node:crypto";
import { AnalyticalIdentityConflictError, ANALYTICAL_SCHEMA, ANALYTICAL_VERSION } from "./analytical_types.ts";
import type { AnalyticalArtifact, Hash } from "./analytical_types.ts";
import { validateAnalyticalArtifact } from "./analytical_validate.ts";

type Field = [key: string, kind: "keep" | "omitempty" | "omitundefined", encode: (v: any) => string];

function goString(s: string): string {
  return JSON.stringify(s).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function canonicalTime(s: string): string {
  let t = s.replace(/[+-]00:00$/, "Z");
  t = t.replace(/\.(\d*?)0+(Z|[+-]\d\d:\d\d)$/, (_m, digits: string, zone: string) => (digits ? "." + digits : "") + zone);
  return goString(t);
}

function sortedAny(v: any): string {
  if (v === null || typeof v !== "object") return typeof v === "string" ? goString(v) : JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(sortedAny).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => goString(k) + ":" + sortedAny(v[k])).join(",") + "}";
}

function isEmpty(v: any): boolean {
  if (v === undefined || v === null || v === false || v === "" || v === 0) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function struct(fields: Field[]) {
  return (obj: any): string => {
    const parts: string[] = [];
    for (const [key, kind, enc] of fields) {
      const v = obj?.[key];
      if (kind === "omitempty" && isEmpty(v)) continue;
      if (kind === "omitundefined" && v === undefined) continue;
      parts.push(goString(key) + ":" + enc(v));
    }
    return "{" + parts.join(",") + "}";
  };
}

const str = (v: any) => goString(v ?? "");
const arr = (enc: (v: any) => string) => (v: any) => (v == null ? "null" : "[" + v.map(enc).join(",") + "]");
const bool = (v: any) => (v ? "true" : "false");

const hash = struct([["algorithm", "keep", str], ["value", "keep", str]]);
const period = struct([["start", "keep", str], ["end", "keep", str], ["basis", "omitempty", str]]);
const quality = struct([["code", "keep", str], ["message", "omitempty", str]]);
const temporal = struct([["observedAt", "keep", canonicalTime], ["origin", "keep", str], ["geography", "keep", str], ["valueBasis", "keep", str]]);
const result = struct([
  ["metricId", "keep", str], ["temporal", "omitempty", temporal], ["dimensions", "omitempty", sortedAny],
  ["period", "keep", period], ["value", "omitundefined", sortedAny], ["missing", "omitempty", bool],
  ["qualityFlags", "omitempty", arr(quality)],
]);
const artifact = struct([
  ["artifactSchema", "keep", str], ["schemaVersion", "keep", str], ["id", "keep", str], ["artifactHash", "keep", hash],
  ["producer", "keep", str], ["producerVersion", "keep", str], ["generatedAt", "keep", canonicalTime],
  ["externalSubject", "omitempty", struct([["namespace", "keep", str], ["id", "keep", str]])],
  ["datasets", "keep", arr(struct([["id", "keep", str], ["uri", "omitempty", str], ["version", "keep", str], ["hash", "keep", hash]]))],
  ["spec", "keep", struct([["kind", "keep", str], ["reference", "keep", str], ["hash", "keep", hash]])],
  ["parameters", "omitempty", sortedAny], ["dimensions", "omitempty", arr(str)], ["filters", "omitempty", sortedAny],
  ["period", "keep", period], ["population", "keep", struct([["description", "keep", str], ["unit", "omitempty", str]])],
  ["metrics", "keep", arr(struct([["version", "omitempty", str], ["id", "keep", str], ["name", "keep", str],
    ["description", "omitempty", str], ["unit", "keep", str], ["aggregation", "omitempty", str]]))],
  ["results", "keep", arr(result)], ["qualityFlags", "omitempty", arr(quality)],
  ["computation", "keep", struct([["engine", "keep", str], ["engineVersion", "keep", str], ["deterministic", "keep", bool], ["timezone", "omitempty", str]])],
  ["provenance", "keep", arr(struct([["datasetId", "keep", str], ["source", "keep", str], ["retrievedAt", "keep", canonicalTime],
    ["license", "omitempty", str], ["transformationRefs", "omitempty", arr(str)]]))],
]);

/** Canonical JSON of a (Go-compatible byte for byte). */
export function canonicalAnalyticalJSON(a: AnalyticalArtifact): string {
  return artifact(a);
}

export function sha256Hash(data: string | Uint8Array): Hash {
  return { algorithm: "sha256", value: createHash("sha256").update(data).digest("hex") };
}

/** Sets schema identifiers and artifactHash, then validates. Returns a copy. */
export function sealAnalyticalArtifact(a: AnalyticalArtifact): AnalyticalArtifact {
  const draft: AnalyticalArtifact = { ...a, artifactSchema: ANALYTICAL_SCHEMA, schemaVersion: ANALYTICAL_VERSION, artifactHash: { algorithm: "", value: "" } };
  const sealed = { ...draft, artifactHash: sha256Hash(canonicalAnalyticalJSON(draft)) };
  validateAnalyticalArtifact(sealed);
  return sealed;
}

/** Same id and hash: duplicate (true). Same id, different hash: throws. */
export function checkDuplicate(existing: AnalyticalArtifact, incoming: AnalyticalArtifact): boolean {
  if (existing.id !== incoming.id) return false;
  if (existing.artifactHash.value.toLowerCase() === incoming.artifactHash.value.toLowerCase()) return true;
  throw new AnalyticalIdentityConflictError(incoming.id);
}
