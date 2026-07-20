import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { renderMeiWithVerovio } from "../../lib/verovio-renderer.js";
import { evaluateHistoricalTabRecognition } from "../../lib/historical-tab-recognition-evaluation.js";
import type { PublishHistoricalTabDraftCommand } from "../../lib/historical-tab-recognition-domain.js";
import { HistoricalTabRecognitionService } from "./historical-tab-recognition-service.js";
import { HistoricalTabRecognitionStore } from "./historical-tab-recognition-store.js";
import { WorkspaceStore } from "./workspace-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("source-adaptive historical tablature recognition", () => {
  it("persists PDF-derived geometry, glyph evidence, clustering, and the rendered page", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "vellum-tab-recognition-"));
    roots.push(root);
    let sequence = 0;
    const workspaces = new WorkspaceStore({
      rootDirectory: root,
      createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    });
    const workspace = workspaces.create({ title: "Printed tablature" });
    const source = workspaces.addSourceArtifact(workspace.id, {
      filename: "source.pdf",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
      provenance: { license: "project-authored fixture" },
    });
    const page = Buffer.from("project-authored-png-placeholder");
    const extraction = {
      schemaVersion: 1,
      backend: { id: "vellum.printed-tab-geometry", version: "2" },
      profile: {
        id: "profile.french-five-course.printed.unlabeled",
        version: 1,
        courseCount: 5,
        notationType: "tab.lute.french",
        vocabulary: [..."abcdefghiklmn"],
        spatialRules: {
          courseAlignmentToleranceGap: 0.65,
          minimumGlyphWidthGap: 0.4,
          maximumGlyphWidthGap: 1.35,
          minimumGlyphHeightGap: 0.4,
          maximumGlyphHeightGap: 1.45,
          shapeDistanceThreshold: 8,
        },
      },
      image: { width: 1000, height: 600, threshold: 158 },
      systems: [
        {
          id: "system-1",
          region: { x: 0.05, y: 0.1, width: 0.9, height: 0.3 },
          staffLines: [0.15, 0.18, 0.21, 0.24, 0.27],
          staffPixelLines: [90, 108, 126, 144, 162],
          barlines: [
            {
              id: "system-1-vertical-1",
              region: { x: 0.18, y: 0.15, width: 0.005, height: 0.12 },
              coverage: 0.95,
              classification: "barline-like",
            },
          ],
          events: [
            {
              id: "system-1-event-1",
              region: { x: 0.1, y: 0.1, width: 0.08, height: 0.3 },
              anchorX: 0.14,
              glyphIds: ["system-1-glyph-1"],
              verticalCandidateIds: ["system-1-vertical-1"],
              reviewState: "unreviewed",
            },
            {
              id: "system-1-event-2",
              region: { x: 0.18, y: 0.1, width: 0.08, height: 0.3 },
              anchorX: 0.22,
              glyphIds: ["system-1-glyph-2"],
              verticalCandidateIds: [],
              reviewState: "unreviewed",
            },
          ],
        },
      ],
      glyphs: [
        {
          id: "system-1-glyph-1",
          region: { x: 0.13, y: 0.15, width: 0.02, height: 0.03 },
          pixelBounds: { left: 130, top: 90, right: 149, bottom: 107 },
          area: 81,
          fingerprint: "a".repeat(64),
          shapeFingerprint: "b".repeat(64),
          shapeCode: "01".repeat(18),
          clusterEligible: true,
          clusterId: "cluster-1",
          courseCandidate: 1,
        },
        {
          id: "system-1-glyph-2",
          region: { x: 0.21, y: 0.18, width: 0.005, height: 0.01 },
          pixelBounds: { left: 210, top: 108, right: 214, bottom: 113 },
          area: 12,
          fingerprint: "c".repeat(64),
          shapeFingerprint: "d".repeat(64),
          shapeCode: "02".repeat(18),
          clusterEligible: false,
          clusterId: "cluster-2",
          courseCandidate: 2,
        },
      ],
      clusters: [
        {
          id: "cluster-1",
          kind: "fret-letter",
          signature: `fret:${"b".repeat(64)}`,
          shapeCode: "01".repeat(18),
          glyphIds: ["system-1-glyph-1"],
          label: null,
        },
        {
          id: "cluster-2",
          kind: "other",
          signature: `raw:${"c".repeat(64)}`,
          shapeCode: null,
          glyphIds: ["system-1-glyph-2"],
          label: null,
        },
      ],
      hypotheses: [],
      diagnostics: ["Detected one project-authored system."],
    };
    const calls: string[] = [];
    const runner = {
      run: async (request: { command: string }) => {
        calls.push(request.command);
        return request.command === "pdftoppm"
          ? {
              stdout: "",
              stderr: "",
              exitCode: 0,
              files: new Map([["page.png", page]]),
              durationMs: 1,
            }
          : {
              stdout: JSON.stringify(extraction),
              stderr: "",
              exitCode: 0,
              files: new Map<string, Buffer>(),
              durationMs: 1,
            };
      },
    };
    const store = new HistoricalTabRecognitionStore({ rootDirectory: root, workspaces });
    const service = new HistoricalTabRecognitionService({
      workspaces,
      store,
      runner,
      createId: () => "00000000-0000-4000-8000-000000000999",
      now: () => new Date("2026-07-19T12:00:00.000Z"),
    });

    const run = await service.recognize(workspace.id, {
      sourceArtifactId: source.id,
      sourcePage: 9,
      courseCount: 5,
    });

    expect(calls).toEqual(["pdftoppm", "python3"]);
    expect(run.id).toBe("tab-recognition.00000000-0000-4000-8000-000000000999");
    expect(run.systems[0]?.events[0]?.glyphIds).toEqual(["system-1-glyph-1"]);
    expect(run.backend.configuration).toMatchObject({ dpi: 240, courseCount: 5, threshold: 158 });
    expect(store.pageImage(workspace.id, run.id)).toEqual(page);

    const reviewedDraft: PublishHistoricalTabDraftCommand = {
      title: "Reviewed printed tablature",
      batchName: "Initial system review",
      events: [
        {
          id: "system-1-event-1",
          sourceEventIds: ["system-1-event-1"],
          region: { x: 0.1, y: 0.1, width: 0.08, height: 0.3 },
          courses: ["a", null, "c", null, null],
          rhythmGlyph: "flag-1",
          dots: 0,
          ornaments: "",
          marks: "vertical stroke",
          verticalMark: "barline",
          state: "confirmed",
        },
        {
          id: "system-1-event-2",
          sourceEventIds: ["system-1-event-2"],
          region: { x: 0.18, y: 0.1, width: 0.08, height: 0.3 },
          courses: [null, "b", null, null, null],
          rhythmGlyph: "absent",
          dots: 0,
          ornaments: "",
          marks: "",
          verticalMark: "none",
          state: "confirmed",
        },
      ],
      reviewMetrics: {
        untouched: 0,
        reviewed: 2,
        corrected: 2,
        regrouped: 0,
        propagated: 0,
        rejected: 0,
        unresolved: 0,
        keyboardActions: 12,
      },
    };
    const evaluation = evaluateHistoricalTabRecognition(reviewedDraft, reviewedDraft.events);
    expect(evaluation).toMatchObject({
      status: "pass",
      comparedEvents: 2,
      propagation: { proposedEvents: 0, rejectedEvents: 0 },
      reviewerBurden: { keyboardActionsPerEvent: 6 },
    });
    expect(
      evaluateHistoricalTabRecognition(
        {
          ...reviewedDraft,
          events: [
            { ...reviewedDraft.events[0], courses: ["b", null, null, null, null] },
            reviewedDraft.events[1],
          ],
        },
        reviewedDraft.events
      )
    ).toMatchObject({ status: "fail", mismatches: { courses: ["system-1-event-1"] } });

    const published = service.publish(workspace.id, run.id, reviewedDraft);
    const { edition, recognitionProfile } = published;
    expect(edition.extraction).toMatchObject({
      recognitionRunId: run.id,
      initialReviewBatch: {
        name: "Initial system review",
        confirmedEvents: 2,
        ambiguousEvents: 0,
        reviewMetrics: { corrected: 2, keyboardActions: 12 },
      },
    });
    expect(edition.mei).toContain('type="diplomatic-event visible-rhythm-flag-1"');
    expect(edition.mei).not.toMatch(/<tabGrp[^>]+ dur=/);
    expect(edition.tokens).toHaveLength(6);
    expect(edition.tokens.some((token) => token.kind === "barline")).toBe(true);
    expect(edition.mei).toContain("diplomatic-system-1-measure-2");
    const rendered = await renderMeiWithVerovio(
      edition.mei,
      edition.tokens.filter((token) => token.kind === "tablature").map((token) => token.id)
    );
    expect(rendered.svg).toContain("reviewed-event-1-course-1");
    expect(recognitionProfile.labels).toEqual([
      {
        signature: `fret:${"b".repeat(64)}`,
        shapeCode: "01".repeat(18),
        label: "a",
        evidenceEventIds: ["system-1-event-1"],
      },
    ]);
    expect(recognitionProfile.version).toBe(2);
    expect(recognitionProfile).not.toHaveProperty("parentProfileId");
    expect(store.getProfile(workspace.id, recognitionProfile.id)).toEqual(recognitionProfile);

    const reapplied = await new HistoricalTabRecognitionService({
      workspaces,
      store,
      runner,
      createId: () => "00000000-0000-4000-8000-000000000998",
      now: () => new Date("2026-07-19T13:00:00.000Z"),
    }).recognize(workspace.id, {
      sourceArtifactId: source.id,
      sourcePage: 9,
      courseCount: 5,
      recognitionProfileId: recognitionProfile.id,
    });
    expect(reapplied.clusters[0]?.label).toBe("a");
    expect(reapplied.clusters[1]?.label).toBeNull();
    expect(reapplied.profile.id).toBe(recognitionProfile.id);
    expect(reapplied.hypotheses).toEqual([
      expect.objectContaining({
        kind: "fret-cluster-label",
        clusterId: "cluster-1",
        proposedLabel: "a",
        authority: "proposal",
      }),
    ]);
  });
});
