// Live checks for question-conditioned research (insight #108) and
// ReasoningProfile (insight #111/#112) that pinned fixture 18 does not cover.
// They only assert what the Public Contract promises; the SDK interprets
// neither the question nor the profile. Runs against INSIGHT_MODEL_BACKED_URL
// and, like conformance.test.ts, fails instead of skipping when
// INSIGHT_REQUIRE_CONFORMANCE=1 and no engine URL is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { InsightClient, InsightError } from "../src/index.ts";

const baseUrl = process.env.INSIGHT_MODEL_BACKED_URL;
const required = process.env.INSIGHT_REQUIRE_CONFORMANCE === "1";
const skip = !baseUrl && !required && "set INSIGHT_MODEL_BACKED_URL to run";

function client(): InsightClient {
  if (!baseUrl) throw new Error("no URL for the model_backed engine");
  return new InsightClient({ baseUrl, pollIntervalMs: 20, timeoutMs: 10_000 });
}

async function subjectWithEvidence(c: InsightClient): Promise<string> {
  const uniq = randomBytes(6).toString("hex");
  const { subjectId } = await c.createSubject({ subject: { namespace: "sdk-js-live", id: `reasoning-${uniq}` } });
  await c.addEvidence(subjectId, { documents: [{ externalRef: "e1", source: "document", content: "The observed measure changed after the recorded event." }] });
  return subjectId;
}

test("startAnalysis resolves GENERAL_RESEARCH and round-trips researchQuestion when the profile is omitted", { skip }, async () => {
  const c = client();
  const subjectId = await subjectWithEvidence(c);
  const question = "What explanations are consistent with the observed change?";
  const { analysisId } = await c.startAnalysis(subjectId, { researchQuestion: question });
  const run = await c.waitForAnalysis(subjectId, analysisId);
  assert.equal(run.status, "completed");
  assert.equal(run.reasoningProfile, "GENERAL_RESEARCH");
  assert.equal(run.researchQuestion, question);
});

test("compareAnalyses reports an input change when only the researchQuestion differs", { skip }, async () => {
  const c = client();
  const subjectId = await subjectWithEvidence(c);
  const first = await c.startAnalysis(subjectId, { researchQuestion: "What explains the change?" });
  const second = await c.startAnalysis(subjectId, { researchQuestion: "What would falsify the change?" });
  await c.waitForAnalysis(subjectId, first.analysisId);
  await c.waitForAnalysis(subjectId, second.analysisId);
  const { comparison } = await c.compareAnalyses(subjectId, first.analysisId, second.analysisId);
  assert.equal(comparison.input.state, "CHANGED");
  assert.deepEqual(comparison.input.researchQuestion, { field: "researchQuestion", from: "What explains the change?", to: "What would falsify the change?" });
  assert.deepEqual(comparison.input.documentsAdded, []);
  assert.deepEqual(comparison.input.documentsRemoved, []);
});

test("startAnalysis fails with INVALID_REQUEST when the reasoningProfile is unknown", { skip }, async () => {
  const c = client();
  const subjectId = await subjectWithEvidence(c);
  await assert.rejects(
    c.startAnalysis(subjectId, { reasoningProfile: "MARKETING" as never }),
    (error: unknown) => error instanceof InsightError && error.code === "INVALID_REQUEST" && error.httpStatus === 400,
  );
});
