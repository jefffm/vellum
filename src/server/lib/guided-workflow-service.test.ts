import { describe, expect, it, vi } from "vitest";
import type { GuidedWorkflow } from "../../lib/music-domain.js";
import { GuidedWorkflowService } from "./guided-workflow-service.js";
import type { WorkspaceStore } from "./workspace-store.js";

describe("GuidedWorkflowService", () => {
  it("persists exact stages, resumes interruption, and never replaces a completed sibling", () => {
    const records = new Map<string, GuidedWorkflow>();
    const workspace = {
      id: "workspace.1111111111111111",
      brief: {
        targetConfigurations: [
          { id: "target.guitar", instrumentId: "baroque-guitar-5" },
          { id: "target.lute", instrumentId: "baroque-lute-13" },
        ],
      },
    };
    const store = {
      getSourceArtifact: vi.fn(() => ({ id: "source.1111111111111111" })),
      get: vi.fn(() => workspace),
      listGuidedWorkflows: vi.fn(() => [...records.values()]),
      saveGuidedWorkflow: vi.fn((_workspaceId: string, workflow: GuidedWorkflow) => {
        records.set(workflow.id, structuredClone(workflow));
        return workflow;
      }),
      getGuidedWorkflow: vi.fn((_workspaceId: string, id: string) =>
        structuredClone(records.get(id)!)
      ),
      getScoreTranscription: vi.fn(() => ({ version: 2 })),
      getNormalizedScore: vi.fn(() => ({ version: 3 })),
      getAnalysisRecord: vi.fn(() => ({ version: 4 })),
      getOmrRun: vi.fn(() => ({ id: "omr.1111111111111111" })),
      getArrangementScore: vi.fn(() => ({ version: 1 })),
      getArrangementSearch: vi.fn(() => ({ id: "search.1111111111111111" })),
      getDeliverable: vi.fn((_workspaceId: string, id: string) => ({ id })),
    } as unknown as WorkspaceStore;
    const service = new GuidedWorkflowService({
      store,
      createId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      now: () => new Date("2026-07-12T12:00:00.000Z"),
    });
    const created = service.create(workspace.id, {
      sourceArtifactId: "source.1111111111111111",
      optical: true,
      ocrAutoAcceptConfidence: 0.8,
      preservationPolicy: "faithful_reduction",
    });
    expect(created.stage).toBe("source_saved");
    expect(created.performanceBrief).toMatchObject({
      intendedUse: "study",
      performerProfile: {
        proficiency: "intermediate",
        assumptionSource: "guided_start_default_pending_owner_review",
      },
      reliabilityGoal: "repeatable",
    });
    expect(created.targets.map((target) => target.status)).toEqual(["pending", "pending"]);

    service.checkpoint(workspace.id, created.id, {
      stage: "target_search",
      omrRunId: "omr.1111111111111111",
      scoreTranscriptionId: "transcription.1111111111111111",
      scoreTranscriptionVersion: 2,
      normalizedScoreId: "score.1111111111111111",
      normalizedScoreVersion: 3,
      analysisRecordId: "analysis.1111111111111111",
      analysisRecordVersion: 4,
    });
    const firstComplete = {
      targetConfigurationId: "target.guitar",
      status: "complete" as const,
      arrangementSearchId: "search.1111111111111111",
      arrangementScoreId: "arrangement.1111111111111111",
      arrangementScoreVersion: 1,
      deliverableIds: ["deliverable.1111111111111111"],
    };
    service.checkpoint(workspace.id, created.id, {
      stage: "projection",
      targets: [firstComplete],
    });
    const interrupted = service.interrupt(workspace.id, created.id, "target_projection_failed");
    expect(interrupted.status).toBe("interrupted");
    expect(service.resume(workspace.id, created.id)).toMatchObject({
      status: "active",
      resumeCount: 1,
      performanceBrief: created.performanceBrief,
    });
    const secondFailed = service.checkpoint(workspace.id, created.id, {
      targets: [
        {
          targetConfigurationId: "target.lute",
          status: "failed",
          deliverableIds: [],
          errorCode: "compile_failed",
        },
      ],
    });
    expect(secondFailed.targets[0]).toEqual(firstComplete);
    expect(secondFailed.targets[1]?.status).toBe("failed");
    expect(() =>
      service.checkpoint(workspace.id, created.id, {
        targets: [{ ...firstComplete, arrangementScoreVersion: 2 }],
      })
    ).toThrow("Completed target is immutable");
    expect(() => service.checkpoint(workspace.id, created.id, { stage: "recognizing" })).toThrow(
      "cannot move backward"
    );
  });
});
