import type { ResearchResult } from "./contract.gen.ts";

/**
 * Forward-tolerant view of Insight Research Artifact v1.
 *
 * The Public Engine embeds the artifact verbatim in ResearchResult.artifact.
 * This view exposes stable fields useful to SDK consumers without moving
 * Research semantics into the SDK.
 */
export interface ResearchArtifactView {
  artifactSchema: string;
  schemaVersion: string;
  analysisId?: string;
  researchRunId?: string;
  iterationId?: string;
  iterationSequence?: number;
  researchQuestion: string;
  researchStage?: string;
  semanticAnalysisMode?: string;
  insights: ArtifactInsight[];
  researchGaps?: Record<string, unknown>[];
  nextDataRequirements?: Record<string, unknown>[];
  whatWeCannotConclude?: string[];
  decisionReadiness?: { state?: string; reasons?: string[] };
  effectiveDecisionReadiness?: string;
  provenance?: { execution?: unknown; input?: unknown };
  [key: string]: unknown;
}

/**
 * Export-facing hypothesis and its evidence.
 *
 * `hypothesis` is the domain-neutral alias. `latentNeed` and other
 * customer-oriented fields remain optional legacy compatibility fields.
 */
export interface ArtifactInsight {
  id: string;
  title: string;
  observation?: string;
  statedNeed?: string;
  latentNeed?: string;
  hypothesis?: string;
  expectation?: string;
  surprisingFact?: string;
  rationale?: string;
  alternativeInterpretation?: string;
  hypothesisSetId?: string;
  hypothesisRole?: string;
  causalStatus?: string;
  validationStatus?: string;
  identificationStatus?: string;
  missingEvidence?: string[];
  falsificationCriteria?: string[];
  supportingEvidence?: Record<string, unknown>[];
  counterEvidence?: Record<string, unknown>[];
  neutralEvidence?: Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * Returns the embedded Research Artifact as a typed, forward-tolerant view.
 * Unknown additive fields remain available through the index signatures.
 */
export function viewResearchArtifact(result: ResearchResult): ResearchArtifactView {
  return result.artifact as ResearchArtifactView;
}
