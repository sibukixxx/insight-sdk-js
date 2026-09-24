import { test } from "node:test";
import assert from "node:assert/strict";
import { InsightClient } from "../src/index.ts";

interface Captured {
  url: string;
  method: string;
  body: any;
}

function recordingFetch(response: string, captured: Captured[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(response, { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("compareAnalyses calls the comparison path with escaped ids and no body", async () => {
  const captured: Captured[] = [];
  const client = new InsightClient({ baseUrl: "http://engine", fetch: recordingFetch('{"contractVersion":"1","subjectId":"s","comparison":{}}', captured) });
  await client.compareAnalyses("s/1", "a", "b");
  assert.deepEqual(captured, [{ url: "http://engine/api/public/v1/subjects/s%2F1/analyses/a/compare/b", method: "GET", body: undefined }]);
});

test("reEvaluate fills contractVersion and idempotencyKey", async () => {
  const captured: Captured[] = [];
  const client = new InsightClient({ baseUrl: "http://engine", fetch: recordingFetch('{"contractVersion":"1"}', captured) });
  await client.reEvaluate("run-1", { correlationKey: "c", previousIterationId: "it-1", analysisId: "an-1", trigger: { kind: "MANUAL" }, evidenceChanges: {} } as any);
  assert.equal(captured[0]?.url, "http://engine/api/public/v1/research-runs/run-1/re-evaluations");
  assert.equal(captured[0]?.method, "POST");
  assert.equal(captured[0]?.body.contractVersion, "1");
  assert.equal(captured[0]?.body.idempotencyKey.length, 32);
});

test("applyTemporalOperation fills only contractVersion because the request has no idempotency key", async () => {
  const captured: Captured[] = [];
  const client = new InsightClient({ baseUrl: "http://engine", fetch: recordingFetch('{"contractVersion":"1","artifact":{}}', captured) });
  await client.applyTemporalOperation({ artifact: {}, operation: {} });
  assert.equal(captured[0]?.url, "http://engine/api/public/v1/temporal-operations");
  assert.equal(captured[0]?.body.contractVersion, "1");
  assert.equal("idempotencyKey" in captured[0]!.body, false);
});
