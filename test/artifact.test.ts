import assert from "node:assert/strict";
import test from "node:test";
import { viewResearchArtifact, type ResearchResult } from "../src/index.ts";

test("research artifact view exposes generic hypothesis alias", () => {
  const result = {
    contractVersion: "1",
    subjectId: "subject-1",
    researchRunId: "run-1",
    iterationId: "iteration-1",
    sequence: 1,
    artifact: {
      artifactSchema: "insight-lab.research-artifact",
      schemaVersion: "1",
      researchQuestion: "Why did the measure change?",
      insights: [{
        id: "insight-1",
        title: "Primary explanation",
        latentNeed: "legacy compatibility carrier",
        hypothesis: "domain-neutral explanatory hypothesis",
      }],
    },
  } as unknown as ResearchResult;

  const view = viewResearchArtifact(result);
  assert.equal(view.insights[0]?.hypothesis, "domain-neutral explanatory hypothesis");
  assert.equal(view.insights[0]?.latentNeed, "legacy compatibility carrier");
});
