// Analytical Artifact v1 wire types (insight contracts/analytical-artifact/v1,
// pinned in contract/analytical-artifact/v1). An artifact records
// deterministic calculation output only; it is never a cause, hypothesis,
// claim or insight.

export const ANALYTICAL_SCHEMA = "insight-lab.analytical-artifact";
export const ANALYTICAL_VERSION = "1";

export interface Hash { algorithm: string; value: string }
export interface DatasetRef { id: string; uri?: string; version: string; hash: Hash }
export interface SpecRef { kind: string; reference: string; hash: Hash }
/** Opaque producer-owned identity; Insight never interprets it. */
export interface ExternalSubjectRef { namespace: string; id: string }
export interface Period { start: string; end: string; basis?: string }
export interface Population { description: string; unit?: string }
export interface MetricDefinition {
  version?: string;
  id: string;
  name: string;
  description?: string;
  unit: string;
  aggregation?: string;
}
export interface QualityFlag { code: string; message?: string }
export interface TemporalMetadata {
  /** RFC 3339 timestamp. */
  observedAt: string;
  origin: "observed" | "derived";
  geography: string;
  valueBasis: "nominal" | "real" | "not_applicable";
}
export type Scalar = number | string | boolean | null;
export interface Result {
  metricId: string;
  temporal?: TemporalMetadata;
  dimensions?: Record<string, string>;
  period: Period;
  /** Absent when missing is true. Unknown is never coerced to 0. */
  value?: Scalar;
  missing?: boolean;
  qualityFlags?: QualityFlag[];
}
export interface Computation { engine: string; engineVersion: string; deterministic: boolean; timezone?: string }
export interface SourceProvenance {
  datasetId: string;
  source: string;
  /** RFC 3339 timestamp. */
  retrievedAt: string;
  license?: string;
  transformationRefs?: string[];
}
export interface AnalyticalArtifact {
  artifactSchema: string;
  schemaVersion: string;
  id: string;
  artifactHash: Hash;
  producer: string;
  producerVersion: string;
  /** RFC 3339 timestamp. */
  generatedAt: string;
  externalSubject?: ExternalSubjectRef;
  datasets: DatasetRef[];
  spec: SpecRef;
  parameters?: Record<string, unknown>;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  period: Period;
  population: Population;
  metrics: MetricDefinition[];
  results: Result[];
  qualityFlags?: QualityFlag[];
  computation: Computation;
  provenance: SourceProvenance[];
}

export class InvalidAnalyticalArtifactError extends Error {
  constructor(message: string) {
    super(`invalid analytical artifact: ${message}`);
    this.name = "InvalidAnalyticalArtifactError";
  }
}

export class AnalyticalIdentityConflictError extends Error {
  constructor(id: string) {
    super(`analytical artifact identity conflict: id "${id}" has different artifactHash`);
    this.name = "AnalyticalIdentityConflictError";
  }
}
