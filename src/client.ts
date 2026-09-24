import { CONTRACT_VERSION } from "./contract.gen.ts";
import type {
  AddEvidenceRequest,
  AnalysisResults,
  AnalysisRun,
  AppendIterationRequest,
  CreateResearchRunRequest,
  CreateSubjectRequest,
  EngineInfo,
  ErrorResponse,
  EvidenceReceipt,
  ResearchResult,
  StartAnalysisRequest,
  Subject,
  AnalysisList,
  CreateDatasetProfileRequest,
  CreateScenarioSetRequest,
  DatasetProfile,
  EvaluateScenariosRequest,
  ReEvaluationRequest,
  ReEvaluationResult,
  ResearchRunList,
  ResearchTimeline,
  ReviseSelectionPlanRequest,
  RunComparisonResult,
  ScaffoldScenarioSetRequest,
  ScenarioAnalysis,
  ScenarioEvaluationResult,
  ScenarioSetResult,
  SelectionPlan,
  SelectionPlanList,
  TemporalOperationRequest,
  TemporalOperationResult,
  TriageRequest,
} from "./contract.gen.ts";
import { InsightError } from "./errors.ts";

/** A request whose contract envelope the client fills in when omitted. */
export type Envelope<T> = Omit<T, "contractVersion" | "idempotencyKey"> & {
  contractVersion?: string;
  idempotencyKey?: string;
};

/** A request whose contractVersion the client fills in when omitted. */
export type VersionOptional<T> = Omit<T, "contractVersion"> & { contractVersion?: string };

export interface ClientOptions {
  /** Engine base URL, e.g. "http://127.0.0.1:8787". */
  baseUrl: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /** WaitForAnalysis polling interval in milliseconds. Default 500. */
  pollIntervalMs?: number;
  /** fetch implementation. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface CallOptions {
  /** Aborts the call. Combined with the client timeout. */
  signal?: AbortSignal;
}

/** Returns a random idempotency key. Reuse it when retrying the same request. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Thin client for the Insight Lab Public Engine Contract v1. It holds no
 * research logic, scoring or domain policy; every rule is enforced by the
 * engine and reported back as a typed InsightError.
 */
export class InsightClient {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #pollIntervalMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: ClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#pollIntervalMs = options.pollIntervalMs ?? 500;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  getEngine(options?: CallOptions): Promise<EngineInfo> {
    return this.#call("GET", "/engine", undefined, options);
  }

  createSubject(request: Envelope<CreateSubjectRequest>, options?: CallOptions): Promise<Subject> {
    return this.#call("POST", "/subjects", withEnvelope(request), options);
  }

  addEvidence(subjectId: string, request: Envelope<AddEvidenceRequest>, options?: CallOptions): Promise<EvidenceReceipt> {
    return this.#call("POST", `/subjects/${enc(subjectId)}/evidence`, withEnvelope(request), options);
  }

  startAnalysis(subjectId: string, request: Envelope<StartAnalysisRequest> = {}, options?: CallOptions): Promise<AnalysisRun> {
    return this.#call("POST", `/subjects/${enc(subjectId)}/analyses`, withEnvelope(request), options);
  }

  getAnalysis(subjectId: string, analysisId: string, options?: CallOptions): Promise<AnalysisRun> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/analyses/${enc(analysisId)}`, undefined, options);
  }

  /** Polls until the run completes or fails. A failed run resolves; inspect status and error. */
  async waitForAnalysis(subjectId: string, analysisId: string, options?: CallOptions): Promise<AnalysisRun> {
    for (;;) {
      const run = await this.getAnalysis(subjectId, analysisId, options);
      if (run.status === "completed" || run.status === "failed") return run;
      await sleep(this.#pollIntervalMs, options?.signal);
    }
  }

  getAnalysisResults(subjectId: string, analysisId: string, options?: CallOptions): Promise<AnalysisResults> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/analyses/${enc(analysisId)}/results`, undefined, options);
  }

  createResearchRun(subjectId: string, request: Envelope<CreateResearchRunRequest>, options?: CallOptions): Promise<ResearchResult> {
    return this.#call("POST", `/subjects/${enc(subjectId)}/research-runs`, withEnvelope(request), options);
  }

  appendIteration(researchRunId: string, request: Envelope<AppendIterationRequest>, options?: CallOptions): Promise<ResearchResult> {
    return this.#call("POST", `/research-runs/${enc(researchRunId)}/iterations`, withEnvelope(request), options);
  }

  getResearchRun(researchRunId: string, options?: CallOptions): Promise<ResearchResult> {
    return this.#call("GET", `/research-runs/${enc(researchRunId)}`, undefined, options);
  }

  /** POST /subjects/{subjectId}/dataset-profiles */
  createDatasetProfile(subjectId: string, request: Envelope<CreateDatasetProfileRequest>, options?: CallOptions): Promise<DatasetProfile> {
    return this.#call("POST", `/subjects/${enc(subjectId)}/dataset-profiles`, withEnvelope(request), options);
  }
  /** GET /subjects/{subjectId}/dataset-profiles/{profileId} */
  getDatasetProfile(subjectId: string, profileId: string, options?: CallOptions): Promise<DatasetProfile> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/dataset-profiles/${enc(profileId)}`, undefined, options);
  }
  /** POST /subjects/{subjectId}/dataset-profiles/{profileId}/triage */
  triage(subjectId: string, profileId: string, request: Envelope<TriageRequest>, options?: CallOptions): Promise<SelectionPlan> {
    return this.#call("POST", `/subjects/${enc(subjectId)}/dataset-profiles/${enc(profileId)}/triage`, withEnvelope(request), options);
  }
  /** GET /subjects/{subjectId}/dataset-profiles/{profileId}/selection-plans */
  listSelectionPlans(subjectId: string, profileId: string, options?: CallOptions): Promise<SelectionPlanList> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/dataset-profiles/${enc(profileId)}/selection-plans`, undefined, options);
  }
  /** GET /selection-plans/{planId} */
  getSelectionPlan(planId: string, options?: CallOptions): Promise<SelectionPlan> {
    return this.#call("GET", `/selection-plans/${enc(planId)}`, undefined, options);
  }
  /** POST /selection-plans/{planId}/revisions */
  reviseSelectionPlan(planId: string, request: Envelope<ReviseSelectionPlanRequest>, options?: CallOptions): Promise<SelectionPlan> {
    return this.#call("POST", `/selection-plans/${enc(planId)}/revisions`, withEnvelope(request), options);
  }
  /** GET /subjects/{subjectId}/analyses */
  listAnalyses(subjectId: string, options?: CallOptions): Promise<AnalysisList> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/analyses`, undefined, options);
  }
  /** GET /subjects/{subjectId}/analyses/{analysisId}/compare/{otherAnalysisId} */
  compareAnalyses(subjectId: string, analysisId: string, otherAnalysisId: string, options?: CallOptions): Promise<RunComparisonResult> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/analyses/${enc(analysisId)}/compare/${enc(otherAnalysisId)}`, undefined, options);
  }
  /** GET /subjects/{subjectId}/research-runs */
  listResearchRuns(subjectId: string, options?: CallOptions): Promise<ResearchRunList> {
    return this.#call("GET", `/subjects/${enc(subjectId)}/research-runs`, undefined, options);
  }
  /** POST /research-runs/{researchRunId}/re-evaluations */
  reEvaluate(researchRunId: string, request: Envelope<ReEvaluationRequest>, options?: CallOptions): Promise<ReEvaluationResult> {
    return this.#call("POST", `/research-runs/${enc(researchRunId)}/re-evaluations`, withEnvelope(request), options);
  }
  /** GET /research-runs/{researchRunId}/scenarios */
  getScenarios(researchRunId: string, options?: CallOptions): Promise<ScenarioAnalysis> {
    return this.#call("GET", `/research-runs/${enc(researchRunId)}/scenarios`, undefined, options);
  }
  /** POST /research-runs/{researchRunId}/scenario-sets */
  createScenarioSet(researchRunId: string, request: Envelope<CreateScenarioSetRequest>, options?: CallOptions): Promise<ScenarioSetResult> {
    return this.#call("POST", `/research-runs/${enc(researchRunId)}/scenario-sets`, withEnvelope(request), options);
  }
  /** POST /research-runs/{researchRunId}/scenario-sets/scaffold */
  scaffoldScenarioSet(researchRunId: string, request: Envelope<ScaffoldScenarioSetRequest>, options?: CallOptions): Promise<ScenarioSetResult> {
    return this.#call("POST", `/research-runs/${enc(researchRunId)}/scenario-sets/scaffold`, withEnvelope(request), options);
  }
  /** POST /research-runs/{researchRunId}/scenario-sets/{scenarioSetId}/evaluations */
  evaluateScenarios(researchRunId: string, scenarioSetId: string, request: Envelope<EvaluateScenariosRequest>, options?: CallOptions): Promise<ScenarioEvaluationResult> {
    return this.#call("POST", `/research-runs/${enc(researchRunId)}/scenario-sets/${enc(scenarioSetId)}/evaluations`, withEnvelope(request), options);
  }
  /** GET /research-runs/{researchRunId}/timeline */
  getResearchTimeline(researchRunId: string, options?: CallOptions): Promise<ResearchTimeline> {
    return this.#call("GET", `/research-runs/${enc(researchRunId)}/timeline`, undefined, options);
  }
  /** POST /temporal-operations */
  applyTemporalOperation(request: VersionOptional<TemporalOperationRequest>, options?: CallOptions): Promise<TemporalOperationResult> {
    return this.#call("POST", `/temporal-operations`, withVersion(request), options);
  }

  async #call<T>(method: string, path: string, body: unknown, options?: CallOptions): Promise<T> {
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/api/public/v1${path}`, {
        method,
        headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (options?.signal?.aborted) throw options.signal.reason;
      throw new InsightError("UNAVAILABLE", timeout.aborted ? `request timed out after ${this.#timeoutMs} ms` : String(error), 0, { cause: error });
    }
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new InsightError("UNAVAILABLE", `response is not a contract message (HTTP ${response.status})`, response.status, { cause: error });
    }
    if (!response.ok) {
      const failure = data as Partial<ErrorResponse>;
      if (!failure.error?.code) {
        throw new InsightError("UNAVAILABLE", `HTTP ${response.status} without a contract error`, response.status);
      }
      throw new InsightError(failure.error.code, failure.error.message ?? "", response.status);
    }
    const version = (data as { contractVersion?: unknown }).contractVersion;
    if (version !== CONTRACT_VERSION) {
      throw new InsightError("UNSUPPORTED_CONTRACT_VERSION", `engine answered with contract version ${JSON.stringify(version)}; this SDK supports "${CONTRACT_VERSION}"`);
    }
    return data as T;
  }
}

function withEnvelope<T extends object>(request: T): T & { contractVersion: string; idempotencyKey: string } {
  const r = request as T & { contractVersion?: string; idempotencyKey?: string };
  return { ...request, contractVersion: r.contractVersion || CONTRACT_VERSION, idempotencyKey: r.idempotencyKey || newIdempotencyKey() };
}

function withVersion<T extends object>(request: T): T & { contractVersion: string } {
  const r = request as T & { contractVersion?: string };
  return { ...request, contractVersion: r.contractVersion || CONTRACT_VERSION };
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}
