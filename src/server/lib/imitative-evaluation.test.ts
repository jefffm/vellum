import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EvaluationStore } from "./evaluation-store.js";
import { runImitativeEvaluation } from "./imitative-evaluation.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("imitative intabulation shared evaluation loop", () => {
  it("ranks complete assignments and protects domain-specific voice relationships", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-imitative-eval-store-"));
    roots.push(root);
    const result = await runImitativeEvaluation({ evaluationRoot: root });

    expect(result.evidence).toMatchObject({
      candidateCount: 2,
      candidateStrategies: ["low-fret-polyphony", "voice-continuity"],
      selectedCandidateId: expect.stringMatching(/^candidate\./),
      completeAssignmentsRanked: true,
      voiceIds: ["part.voiceone", "part.voicethree", "part.voicetwo"],
      orderedEntriesPreserved: true,
      subjectShapesProtected: true,
      voiceContinuityProtected: true,
      cadentialGoalsProtected: true,
      permanentPrincipalVoiceInvented: false,
      deliverableCount: 5,
    });
    expect(result.evidence.uniquePlaybackOccurrenceCount).toBe(result.evidence.soundingEventCount);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      hardGateStatus: "pass",
      acceptanceStatus: "incomplete",
    });
    expect(result.cards[0]!.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimensionId: "source_authority", absoluteOutcome: "pass" }),
        expect.objectContaining({
          dimensionId: "preservation_and_transformation",
          absoluteOutcome: "pass",
        }),
        expect.objectContaining({
          dimensionId: "arrangement_plan_realization",
          absoluteOutcome: "pass",
        }),
        expect.objectContaining({
          dimensionId: "playback_and_performed_form",
          absoluteOutcome: "pass",
        }),
        expect.objectContaining({
          dimensionId: "historical_and_analytical_evidence",
          absoluteOutcome: "unknown",
        }),
      ])
    );
    const store = new EvaluationStore({ rootDirectory: root });
    const caseRun = store.getCaseRun(store.getRun(result.runId).caseRunIds[0]!);
    expect(caseRun.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "imitation.domain_state",
        message: expect.stringMatching(/does not invent a permanent Principal Voice/i),
      })
    );
    expect(JSON.stringify(caseRun)).not.toMatch(/generic counterpoint (pass|grade)/i);
  });
});
