import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import type { ReferencePageAtlasParser } from "./reference-page-atlas-parser.js";
import {
  defineMacePageAtlasSourceProfile,
  ExactAssetReferencePageAtlasSourceProfileResolver,
} from "./reference-page-atlas-source-profile.js";
import {
  OwnerReferencePageAtlasInterruptionError,
  OwnerReferencePageAtlasRegenerationUnavailableError,
  OwnerReferencePageAtlasService,
  OwnerReferencePageAtlasStaleError,
  OwnerReferencePageAtlasUnavailableError,
  type OwnerReferencePageAtlasResolvedContext,
} from "./owner-reference-page-atlas-service.js";
import { OwnerReferenceWorkbenchOpaqueProjector } from "./owner-reference-workbench-service.js";
import {
  createOwnerLocalExtractionStagingWriter,
  createReferenceSourcePageAtlasStagingWriter,
  ReferenceSourceStagingService,
} from "./reference-source-staging-service.js";
import {
  ReferenceSourceStagingConflictError,
  ReferenceSourceStagingIntegrityError,
  ReferenceSourceStagingStore,
} from "./reference-source-staging-store.js";

const NOW = "2026-07-16T12:00:00.000Z";
const OPERATION_KEY = "owner-page-atlas.v1.AAAAAAAAAAAAAAAAAAAAAA";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\nrights-approved synthetic unit fixture");

describe("OwnerReferencePageAtlasService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("commits and corrects the exact Mace candidate graph without exposing authority", async () => {
    const harness = createHarness(roots);
    const initialContext = harness.context(1);
    const startRequest = {
      schemaVersion: 1 as const,
      action: "start" as const,
      workbenchSnapshotRef: initialContext.currentWorkbenchSnapshotRef,
      workbenchCardRef: initialContext.currentWorkbenchCardRef,
      purpose: "Inspect this exact local reference for a Page Atlas.",
      authorization: "owner_attested_local_extraction" as const,
      operationKey: OPERATION_KEY,
      profile: "mace-musicks-monument-1676" as const,
      profileSelection: "owner_selected" as const,
    };
    const receipt = await harness.service.start({
      request: startRequest,
      context: initialContext,
    });
    const replay = await harness.service.start({ request: startRequest, context: initialContext });
    expect(replay).toEqual({
      status: "accepted",
      operationRef: receipt.operationRef,
      replayed: true,
    });

    const readContext = harness.context(2);
    const projection = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: readContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: readContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: readContext,
    });
    expect(projection.atlas.state).toBe("paused");
    expect(projection.atlas.stop).toBeNull();
    expect(projection.target).toMatchObject({
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "75" },
      mappingState: "candidate",
    });
    expect(projection.stagedKnowledge).toMatchObject({
      kind: "mace_twelve_course_diapason_notation",
      authorityState: "non_authoritative",
      courseMappings: [
        { course: 7, sign: "a" },
        { course: 8, sign: "/a" },
        { course: 9, sign: "//a" },
        { course: 10, sign: "///a" },
        { course: 11, sign: "4" },
        { course: 12, sign: "5" },
      ],
      course13Question: {
        course: 13,
        status: "open",
        historicalSignState: "unresolved",
        proposedSign: null,
      },
    });
    if (projection.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
      throw new Error("Expected the exact synthetic Mace release seed");
    }
    const releaseSeed = harness.service.resolveKnowledgeReleaseSeed({
      selection: {
        workbenchSnapshotRef: projection.workbenchSnapshotRef,
        workbenchCardRef: projection.workbenchCardRef,
        operationRef: projection.operationRef,
        expectedProjectionRef: projection.projectionRef,
        candidateRef: projection.stagedKnowledge.candidateRef,
      },
      context: readContext,
    });
    expect(releaseSeed.stagingSnapshotRef).toEqual(ref(harness.store.readCurrentState()!.snapshot));
    expect(releaseSeed.mapping.proposal).toEqual({
      kind: "twelve_course_diapason_mapping",
      courses: [7, 8, 9, 10, 11, 12],
      symbols: ["a", "/a", "//a", "///a", "4", "5"],
      numericSymbolsHaveSlashes: false,
    });
    expect(releaseSeed.question.proposal).toEqual({
      kind: "course_thirteen_notation_question",
      course: 13,
      state: "unresolved",
      forbiddenInference: "sequence_extrapolation",
    });
    expect(releaseSeed.extraction.sourceSegmentRefs).toEqual([ref(releaseSeed.segment)]);
    expect(projection.confidence.sourceIdentity).toEqual({
      state: "unknown",
      reason: "not_assessed",
    });
    expect(projection.confidence.extraction).toEqual({
      state: "unknown",
      reason: "not_assessed",
    });

    let correctionContext = readContext;
    let correctionBasis = projection;
    for (const contextVersion of [3, 4]) {
      await harness.service.resume({
        request: {
          schemaVersion: 1,
          action: "resume",
          workbenchSnapshotRef: correctionContext.currentWorkbenchSnapshotRef,
          workbenchCardRef: correctionContext.currentWorkbenchCardRef,
          operationRef: receipt.operationRef,
          expectedProjectionRef: correctionBasis.projectionRef,
        },
        context: correctionContext,
      });
      correctionContext = harness.context(contextVersion);
      correctionBasis = harness.service.read({
        request: {
          schemaVersion: 1,
          action: "read",
          workbenchSnapshotRef: correctionContext.currentWorkbenchSnapshotRef,
          workbenchCardRef: correctionContext.currentWorkbenchCardRef,
          operationRef: receipt.operationRef,
        },
        context: correctionContext,
      });
    }
    expect(correctionBasis.atlas.version).toBe(3);
    expect(correctionBasis.citedSegmentLineage.versions).toHaveLength(1);

    const correctedReceipt = await harness.service.correctMapping({
      request: {
        schemaVersion: 1,
        action: "correct_mapping",
        workbenchSnapshotRef: correctionContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: correctionContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
        expectedProjectionRef: correctionBasis.projectionRef,
        correction: {
          scanPageNumber: 105,
          printedLocator: "75r",
          reason: "Record the Owner-reviewed printed locator on the exact profiled scan.",
        },
      },
      context: correctionContext,
    });
    expect(correctedReceipt.operationRef).toEqual(receipt.operationRef);
    const correctedContext = harness.context(5);
    const corrected = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: correctedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: correctedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: correctedContext,
    });
    expect(corrected.target).toMatchObject({
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "75r" },
      mappingState: "corrected",
    });
    expect(corrected.citedSegmentLineage.versions).toHaveLength(2);
    expect(corrected.citedSegmentLineage.versions[0]?.successorSegmentRef).toEqual(
      corrected.citedSegmentLineage.versions[1]?.segmentRef
    );
    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(records.filter(({ recordKind }) => recordKind === "citation_successor")).toHaveLength(1);
    expect(
      records.find(
        (record) =>
          record.recordKind === "access_decision" && record.operation === "local_extraction"
      )
    ).toMatchObject({ purpose: "Inspect this exact local reference for a Page Atlas." });
    expect(
      records.find((record) => record.recordKind === "asset_identity_resolution")
    ).toMatchObject({ resolutionState: "candidate", reviewState: "candidate" });
  });

  it("rejects a correction before the cited-segment projection lineage exceeds its bound", async () => {
    const harness = createHarness(roots);
    const started = await startAndReadGeneric(harness);
    let context = started.context;
    let projection = started.projection;

    for (let correction = 1; correction <= 31; correction += 1) {
      await harness.service.correctMapping({
        request: correctionRequest(context, projection, `folio ${correction}`),
        context,
      });
      context = harness.context(correction + 2);
      projection = harness.service.read({
        request: {
          schemaVersion: 1,
          action: "read",
          workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
          workbenchCardRef: context.currentWorkbenchCardRef,
          operationRef: projection.operationRef,
        },
        context,
      });
    }

    expect(projection.citedSegmentLineage.versions).toHaveLength(32);
    const stateBeforeRejectedCorrection = harness.store.readCurrentState()!;

    await expect(
      harness.service.correctMapping({
        request: correctionRequest(context, projection, "overflow"),
        context,
      })
    ).rejects.toMatchObject({
      code: "owner_reference_page_atlas_lineage_limit_conflict",
    });

    const stateAfterRejectedCorrection = harness.store.readCurrentState()!;
    expect(stateAfterRejectedCorrection.head).toEqual(stateBeforeRejectedCorrection.head);
    expect(stateAfterRejectedCorrection.snapshot).toEqual(stateBeforeRejectedCorrection.snapshot);
    const readable = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
        workbenchCardRef: context.currentWorkbenchCardRef,
        operationRef: projection.operationRef,
      },
      context,
    });
    expect(readable.projectionRef).toEqual(projection.projectionRef);
    expect(readable.citedSegmentLineage.versions).toHaveLength(32);
  });

  it("recovers a committed start after a lost response on the successor Workbench snapshot", async () => {
    const parser = parserFixture();
    const harness = createHarness(roots, parser);
    const originalContext = harness.context(1);
    const originalRequest = startRequest(originalContext, "mace-musicks-monument-1676");
    const committed = await harness.service.start({
      request: originalRequest,
      context: originalContext,
    });

    const successorContext = harness.context(2);
    const recovered = await harness.service.start({
      request: {
        ...originalRequest,
        workbenchSnapshotRef: successorContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: successorContext.currentWorkbenchCardRef,
      },
      context: successorContext,
    });

    expect(recovered).toEqual({ ...committed, replayed: true });
    expect(parser.inspect).toHaveBeenCalledTimes(1);
    expect(parser.renderPage).toHaveBeenCalledTimes(1);

    const freshHarness = createHarness(roots);
    const freshContext = freshHarness.context(1);
    await expect(
      freshHarness.service.start({
        request: {
          ...startRequest(freshContext, "generic_paged_source"),
          workbenchSnapshotRef: freshHarness.context(2).currentWorkbenchSnapshotRef,
        },
        context: freshContext,
      })
    ).rejects.toBeInstanceOf(OwnerReferencePageAtlasStaleError);
  });

  it("replays only an exact concurrent correction whose complete record digests match", async () => {
    const controlled = concurrentCorrectionParser();
    const harness = createHarness(roots, controlled.parser);
    const before = await startAndReadGeneric(harness);
    const correction = correctionRequest(before.context, before.projection, "frontispiece");

    controlled.blockTwoCorrections();
    const first = harness.service.correctMapping({ request: correction, context: before.context });
    const second = harness.service.correctMapping({ request: correction, context: before.context });
    await controlled.waitUntilBlocked();
    controlled.release();
    const receipts = await Promise.all([first, second]);

    expect(receipts.map(({ replayed }) => replayed).sort()).toEqual([false, true]);
    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(
      1
    );
    expect(records.filter(({ recordKind }) => recordKind === "citation_successor")).toHaveLength(1);
  });

  it("rejects a concurrent correction when any successor record digest differs", async () => {
    const controlled = concurrentCorrectionParser();
    const harness = createHarness(roots, controlled.parser);
    const before = await startAndReadGeneric(harness);

    controlled.blockTwoCorrections();
    const first = harness.service.correctMapping({
      request: correctionRequest(before.context, before.projection, "frontispiece"),
      context: before.context,
    });
    const second = harness.service.correctMapping({
      request: correctionRequest(before.context, before.projection, "folio ii"),
      context: before.context,
    });
    await controlled.waitUntilBlocked();
    controlled.release();
    const outcomes = await Promise.allSettled([first, second]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(OwnerReferencePageAtlasStaleError),
    });
    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(
      1
    );
    expect(records.filter(({ recordKind }) => recordKind === "citation_successor")).toHaveLength(1);
  });

  it("fails closed when adjacent segment versions lack their canonical citation-successor edge", async () => {
    const harness = createHarness(roots);
    const before = await startAndReadGeneric(harness);
    await harness.service.correctMapping({
      request: correctionRequest(before.context, before.projection, "frontispiece"),
      context: before.context,
    });
    const actual = harness.store.readCurrentState()!;
    const removed = actual.snapshot.records.find(
      ({ recordKind }) => recordKind === "citation_successor"
    );
    expect(removed).toBeDefined();
    const records = actual.snapshot.records.filter(
      ({ recordKind }) => recordKind !== "citation_successor"
    );
    const recordObservations = actual.snapshot.recordObservations?.filter(
      ({ recordRef }) => recordRef.id !== removed!.id || recordRef.digest !== removed!.digest
    );
    const { digest: _discarded, ...core } = {
      ...actual.snapshot,
      records,
      ...(recordObservations ? { recordObservations } : {}),
    };
    const snapshot = { ...core, digest: referenceSourceDigest(core) };
    vi.spyOn(harness.store, "readCurrentState").mockReturnValue({
      head: { ...actual.head, digest: snapshot.digest },
      snapshot,
    });
    const context = harness.context(3);

    expect(() =>
      harness.service.read({
        request: {
          schemaVersion: 1,
          action: "read",
          workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
          workbenchCardRef: context.currentWorkbenchCardRef,
          operationRef: before.projection.operationRef,
        },
        context,
      })
    ).toThrow(OwnerReferencePageAtlasUnavailableError);
  });

  it("never converts an injected staging integrity error into a replay receipt", async () => {
    const injected = new ReferenceSourceStagingIntegrityError("injected integrity failure");
    const harness = createHarness(roots);
    harness.pageAtlasApply.mockImplementationOnce(() => {
      throw injected;
    });
    const context = harness.context(1);

    await expect(
      harness.service.start({
        request: startRequest(context, "generic_paged_source"),
        context,
      })
    ).rejects.toBe(injected);
    expect(
      harness.store
        .readCurrentState()!
        .snapshot.records.some(({ recordKind }) => recordKind === "page_atlas_attempt")
    ).toBe(false);
  });

  it("refuses to regenerate an unpersisted generic preview and resumes after a redacted initial failure", async () => {
    const inspect = vi
      .fn<ReferencePageAtlasParser["inspect"]>()
      .mockRejectedValueOnce(new Error("PRIVATE /tmp/source.pdf stderr canary"))
      .mockResolvedValue(syntheticInspection(5));
    const parser = parserFixture({ inspect });
    const harness = createHarness(roots, parser);
    const initialContext = harness.context(1);
    const receipt = await harness.service.start({
      request: {
        schemaVersion: 1,
        action: "start",
        workbenchSnapshotRef: initialContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: initialContext.currentWorkbenchCardRef,
        purpose: "Build a generic local Page Atlas.",
        authorization: "owner_attested_local_extraction",
        operationKey: OPERATION_KEY,
        profile: "generic_paged_source",
        profileSelection: "owner_selected",
      },
      context: initialContext,
    });
    const failedContext = harness.context(2);
    const failed = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: failedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: failedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: failedContext,
    });
    expect(failed.atlas).toMatchObject({
      state: "failed",
      stop: { reason: "parser_failure", diagnostics: "redacted" },
    });
    expect(JSON.stringify(failed)).not.toContain("PRIVATE");
    expect(JSON.stringify(harness.store.readCurrentState())).not.toContain("PRIVATE");

    await harness.service.resume({
      request: {
        schemaVersion: 1,
        action: "resume",
        workbenchSnapshotRef: failedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: failedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
        expectedProjectionRef: failed.projectionRef,
      },
      context: failedContext,
    });
    const resumedContext = harness.context(3);
    const resumed = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: resumedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: resumedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: resumedContext,
    });
    expect(resumed.atlas.state).toBe("paused");
    expect(resumed.citedSegmentLineage.versions).toHaveLength(1);
    expect(resumed.stagedKnowledge).toEqual({
      kind: "none",
      reason: "generic_profile_has_no_seed",
    });
    const renderCallsBeforePreview = vi.mocked(parser.renderPage).mock.calls.length;
    await expect(
      harness.service.preview({
        request: {
          schemaVersion: 1,
          action: "preview",
          workbenchSnapshotRef: resumedContext.currentWorkbenchSnapshotRef,
          workbenchCardRef: resumedContext.currentWorkbenchCardRef,
          operationRef: receipt.operationRef,
          projectionRef: resumed.projectionRef,
          segmentRef: resumed.citedSegmentLineage.currentSegmentRef!,
        },
        context: resumedContext,
      })
    ).rejects.toBeInstanceOf(OwnerReferencePageAtlasRegenerationUnavailableError);
    expect(parser.renderPage).toHaveBeenCalledTimes(renderCallsBeforePreview);

    await harness.service.resume({
      request: {
        schemaVersion: 1,
        action: "resume",
        workbenchSnapshotRef: resumedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: resumedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
        expectedProjectionRef: resumed.projectionRef,
      },
      context: resumedContext,
    });
    const progressedContext = harness.context(4);
    const progressed = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: progressedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: progressedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: progressedContext,
    });
    await harness.service.correctMapping({
      request: {
        schemaVersion: 1,
        action: "correct_mapping",
        workbenchSnapshotRef: progressedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: progressedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
        expectedProjectionRef: progressed.projectionRef,
        correction: {
          scanPageNumber: 2,
          printedLocator: "frontispiece",
          reason: "Bind an exact generic printed-page locator after Page Atlas extraction.",
        },
      },
      context: progressedContext,
    });
    const correctedContext = harness.context(5);
    const corrected = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: correctedContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: correctedContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: correctedContext,
    });
    expect(corrected.target).toMatchObject({
      scanPageNumber: 2,
      printedLocator: { state: "known", value: "frontispiece" },
      mappingState: "corrected",
    });
    expect(corrected.citedSegmentLineage.versions).toHaveLength(2);
  });

  it("projects rotated landscape canvas geometry from the exact rendered orientation", async () => {
    const parser = parserFixture({
      inspect: vi.fn(async () => ({
        schemaVersion: 1 as const,
        parserId: "poppler.pdfinfo" as const,
        pageCount: 1,
        pages: [
          {
            scanOrdinal: 1,
            widthPoints: 700,
            heightPoints: 500,
            rotationDegrees: 90 as const,
          },
        ],
      })),
      renderPage: vi.fn(async () => ({
        schemaVersion: 1 as const,
        rendererId: "poppler.pdftoppm" as const,
        scanOrdinal: 1,
        mediaType: "image/png" as const,
        widthPixels: 1_000,
        heightPixels: 1_400,
        bytes: new Uint8Array([137, 80, 78, 71, 90]),
      })),
    });
    const harness = createHarness(roots, parser);
    const { projection } = await startAndReadGeneric(harness);

    expect(projection.target).toMatchObject({
      canvas: {
        coordinateSystem: "normalized-top-left.v1",
        widthPixels: 1_000,
        heightPixels: 1_400,
        rotationDegrees: 90,
      },
      pageState: {
        enumeration: "enumerated",
        rasterization: "observed_not_persisted",
        contentExtraction: "not_extracted",
        mappingReview: "not_reviewed",
      },
    });
    expect(projection.atlas.coverage).toMatchObject({
      enumeratedPages: 1,
      rasterObservedPages: 1,
      contentCandidatePages: 0,
      mappingReviewedPages: 0,
    });
  });

  it("refuses resume when the executable identity changes from the immutable Atlas basis", async () => {
    const firstIdentity = syntheticRuntimeIdentity();
    const changedIdentity = {
      ...firstIdentity,
      renderer: { ...firstIdentity.renderer, version: "27.0.0-synthetic" },
    };
    const describeRuntime = vi
      .fn<ReferencePageAtlasParser["describeRuntime"]>()
      .mockResolvedValueOnce(firstIdentity)
      .mockResolvedValue(changedIdentity);
    const parser = parserFixture({ describeRuntime });
    const harness = createHarness(roots, parser);
    const before = await startAndReadGeneric(harness);

    await expect(
      harness.service.resume({
        request: {
          schemaVersion: 1,
          action: "resume",
          workbenchSnapshotRef: before.context.currentWorkbenchSnapshotRef,
          workbenchCardRef: before.context.currentWorkbenchCardRef,
          operationRef: before.projection.operationRef,
          expectedProjectionRef: before.projection.projectionRef,
        },
        context: before.context,
      })
    ).rejects.toBeInstanceOf(OwnerReferencePageAtlasRegenerationUnavailableError);
    expect(parser.inspect).toHaveBeenCalledTimes(1);
    expect(parser.renderPage).toHaveBeenCalledTimes(1);
  });

  it("records an injected interruption as an immutable partial checkpoint", async () => {
    const parser = parserFixture();
    const harness = createHarness(roots, parser, 1);
    const initialContext = harness.context(1);
    const receipt = await harness.service.start({
      request: {
        schemaVersion: 1,
        action: "start",
        workbenchSnapshotRef: initialContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: initialContext.currentWorkbenchCardRef,
        purpose: "Build an interruptible generic Page Atlas.",
        authorization: "owner_attested_local_extraction",
        operationKey: OPERATION_KEY,
        profile: "generic_paged_source",
        profileSelection: "owner_selected",
      },
      context: initialContext,
    });
    const beforeContext = harness.context(2);
    const before = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: beforeContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: beforeContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: beforeContext,
    });
    vi.mocked(parser.inspect).mockRejectedValueOnce(new OwnerReferencePageAtlasInterruptionError());
    await harness.service.resume({
      request: {
        schemaVersion: 1,
        action: "resume",
        workbenchSnapshotRef: beforeContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: beforeContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
        expectedProjectionRef: before.projectionRef,
      },
      context: beforeContext,
    });
    const afterContext = harness.context(3);
    const after = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: afterContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: afterContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: afterContext,
    });
    expect(after.atlas).toMatchObject({
      state: "paused",
      stop: { reason: "interrupted", diagnostics: "redacted" },
    });
    expect(after.atlas.version).toBe(before.atlas.version + 1);
    expect(after.atlas.coverage).toEqual(before.atlas.coverage);
  });

  it("durably checkpoints a resume when its caller drops the AbortSignal", async () => {
    const controlled = abortableResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const controller = new AbortController();
    const pending = harness.service.resume({
      request: resumeRequest(before.context, before.projection),
      context: before.context,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    const atlases = records.filter(({ recordKind }) => recordKind === "page_atlas_version");
    const latest = records.filter(({ recordKind }) => recordKind === "page_atlas_attempt").at(-1);
    expect(controlled.signal()?.aborted).toBe(true);
    expect(atlases).toHaveLength(2);
    expect(latest).toMatchObject({
      attemptKind: "resume",
      status: "interrupted",
      failureCode: "interrupted",
      basisAtlasRef: ref(atlases[0]!),
      outputAtlasRef: ref(atlases[1]!),
    });
  });

  it("durably checkpoints a resume when the parser resolves after caller abort", async () => {
    const controlled = resolvingAfterAbortResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const controller = new AbortController();
    const pending = harness.service.resume({
      request: resumeRequest(before.context, before.projection),
      context: before.context,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    controlled.release();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    const atlases = records.filter(({ recordKind }) => recordKind === "page_atlas_version");
    const latest = records.filter(({ recordKind }) => recordKind === "page_atlas_attempt").at(-1);
    expect(controlled.signal()?.aborted).toBe(true);
    expect(atlases).toHaveLength(2);
    expect(latest).toMatchObject({
      attemptKind: "resume",
      status: "interrupted",
      failureCode: "interrupted",
      basisAtlasRef: ref(atlases[0]!),
      outputAtlasRef: ref(atlases[1]!),
    });
  });

  it("durably checkpoints a mapping correction when its caller drops the AbortSignal", async () => {
    const controlled = abortableResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const controller = new AbortController();
    const pending = harness.service.correctMapping({
      request: correctionRequest(before.context, before.projection, "frontispiece"),
      context: before.context,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    const atlases = records.filter(({ recordKind }) => recordKind === "page_atlas_version");
    const latest = records.filter(({ recordKind }) => recordKind === "page_atlas_attempt").at(-1);
    expect(atlases).toHaveLength(2);
    expect(latest).toMatchObject({
      attemptKind: "correction",
      status: "interrupted",
      failureCode: "interrupted",
      basisAtlasRef: ref(atlases[0]!),
      outputAtlasRef: ref(atlases[1]!),
    });
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toEqual([]);
  });

  it("durably checkpoints a mapping correction when the parser resolves after abort", async () => {
    const controlled = resolvingAfterAbortCorrectionParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const controller = new AbortController();
    const pending = harness.service.correctMapping({
      request: correctionRequest(before.context, before.projection, "frontispiece"),
      context: before.context,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    controlled.release();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    const atlases = records.filter(({ recordKind }) => recordKind === "page_atlas_version");
    const latest = records.filter(({ recordKind }) => recordKind === "page_atlas_attempt").at(-1);
    expect(controlled.signal()?.aborted).toBe(true);
    expect(atlases).toHaveLength(2);
    expect(latest).toMatchObject({
      attemptKind: "correction",
      status: "interrupted",
      failureCode: "interrupted",
      basisAtlasRef: ref(atlases[0]!),
      outputAtlasRef: ref(atlases[1]!),
    });
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toEqual([]);
    expect(records.filter(({ recordKind }) => recordKind === "citation_successor")).toEqual([]);
    expect(
      records.filter(({ recordKind }) => recordKind === "source_segment_version")
    ).toHaveLength(1);
  });

  it("records a dropped AbortSignal while retrying a failed initial extraction", async () => {
    const controlled = abortableFailedInitialRetryParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const initialContext = harness.context(1);
    const receipt = await harness.service.start({
      request: startRequest(initialContext, "generic_paged_source"),
      context: initialContext,
    });
    const retryContext = harness.context(2);
    const failed = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: retryContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: retryContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: retryContext,
    });
    const controller = new AbortController();
    const pending = harness.service.resume({
      request: resumeRequest(retryContext, failed),
      context: retryContext,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_version")).toEqual([]);
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_attempt")).toMatchObject([
      { attemptKind: "initial", status: "failed" },
      {
        attemptKind: "initial",
        status: "interrupted",
        failureCode: "interrupted",
      },
    ]);
    expect(
      records.filter(({ recordKind }) => recordKind === "page_atlas_attempt")[1]
    ).not.toHaveProperty("outputAtlasRef");
  });

  it("records an interrupted failed-initial retry when the parser resolves after abort", async () => {
    const controlled = resolvingAfterAbortFailedInitialRetryParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const initialContext = harness.context(1);
    const receipt = await harness.service.start({
      request: startRequest(initialContext, "generic_paged_source"),
      context: initialContext,
    });
    const retryContext = harness.context(2);
    const failed = harness.service.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: retryContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: retryContext.currentWorkbenchCardRef,
        operationRef: receipt.operationRef,
      },
      context: retryContext,
    });
    const controller = new AbortController();
    const pending = harness.service.resume({
      request: resumeRequest(retryContext, failed),
      context: retryContext,
      signal: controller.signal,
    });
    await controlled.waitUntilBlocked();

    controller.abort();
    controlled.release();
    await expect(pending).resolves.toMatchObject({ replayed: false });

    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(controlled.signal()?.aborted).toBe(true);
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_version")).toEqual([]);
    expect(records.filter(({ recordKind }) => recordKind === "source_segment_version")).toEqual([]);
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_attempt")).toMatchObject([
      { attemptKind: "initial", status: "failed" },
      { attemptKind: "initial", status: "interrupted", failureCode: "interrupted" },
    ]);
  });

  it("lets a completed resume win deterministically over a late parser failure", async () => {
    const controlled = lateFailureResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const request = resumeRequest(before.context, before.projection);
    const lateFailure = harness.service.resume({ request, context: before.context });
    await controlled.waitUntilBlocked();

    await expect(
      harness.service.resume({ request, context: before.context })
    ).resolves.toMatchObject({ replayed: false });
    controlled.fail();
    await expect(lateFailure).rejects.toBeInstanceOf(OwnerReferencePageAtlasStaleError);

    const attempts = harness.store
      .readCurrentState()!
      .snapshot.records.filter(({ recordKind }) => recordKind === "page_atlas_attempt");
    expect(attempts).toMatchObject([
      { attemptKind: "initial", status: "completed" },
      { attemptKind: "resume", status: "completed" },
    ]);
  });

  it("lets a completed correction win deterministically over a late parser failure", async () => {
    const controlled = lateFailureCorrectionParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const request = correctionRequest(before.context, before.projection, "frontispiece");
    const lateFailure = harness.service.correctMapping({ request, context: before.context });
    await controlled.waitUntilBlocked();

    await expect(
      harness.service.correctMapping({ request, context: before.context })
    ).resolves.toMatchObject({ replayed: false });
    controlled.fail();
    await expect(lateFailure).rejects.toBeInstanceOf(OwnerReferencePageAtlasStaleError);

    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(
      1
    );
    expect(
      records.filter(
        (record) =>
          record.recordKind === "page_atlas_attempt" && record.attemptKind === "correction"
      )
    ).toMatchObject([{ status: "completed" }]);
  });

  it("tracks the initial run with an AbortSignal and retains one retryable no-Atlas interruption", async () => {
    let observedSignal: AbortSignal | undefined;
    const inspect = vi.fn<ReferencePageAtlasParser["inspect"]>(async ({ signal }) => {
      observedSignal = signal;
      throw new OwnerReferencePageAtlasInterruptionError();
    });
    const parser = parserFixture({ inspect });
    const harness = createHarness(roots, parser);
    const initialContext = harness.context(1);
    const request = startRequest(initialContext, "generic_paged_source");

    const interruptedReceipt = await harness.service.start({
      request,
      context: initialContext,
    });

    expect(observedSignal).toBeDefined();
    const interruptedRecords = harness.store.readCurrentState()!.snapshot.records;
    const [interruptedAttempt] = interruptedRecords.filter(
      ({ recordKind }) => recordKind === "page_atlas_attempt"
    );
    expect(interruptedAttempt).toMatchObject({
      attemptKind: "initial",
      status: "interrupted",
      failureCode: "interrupted",
    });
    expect(interruptedAttempt).not.toHaveProperty("basisAtlasRef");
    expect(interruptedAttempt).not.toHaveProperty("outputAtlasRef");
    expect(
      interruptedRecords.filter(({ recordKind }) => recordKind === "page_atlas_version")
    ).toEqual([]);
    expect(
      interruptedRecords.filter(({ recordKind }) => recordKind === "source_segment_version")
    ).toEqual([]);

    vi.mocked(parser.inspect).mockResolvedValue(syntheticInspection(110));
    const retryContext = harness.context(2);
    const retry = await harness.service.start({
      request: {
        ...request,
        workbenchSnapshotRef: retryContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: retryContext.currentWorkbenchCardRef,
      },
      context: retryContext,
    });
    expect(retry.operationRef).toEqual(interruptedReceipt.operationRef);
    const finalRecords = harness.store.readCurrentState()!.snapshot.records;
    expect(
      finalRecords.filter(({ recordKind }) => recordKind === "page_atlas_attempt")
    ).toMatchObject([
      { attemptKind: "initial", status: "interrupted" },
      { attemptKind: "initial", status: "completed" },
    ]);
    expect(
      finalRecords.filter(({ recordKind }) => recordKind === "page_atlas_version")
    ).toHaveLength(1);
  });

  it("durably commits cancellation before aborting an in-flight resume", async () => {
    const controlled = abortableResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const atlasCountBefore = harness.store
      .readCurrentState()!
      .snapshot.records.filter(({ recordKind }) => recordKind === "page_atlas_version").length;
    const resume = harness.service.resume({
      request: {
        schemaVersion: 1,
        action: "resume",
        workbenchSnapshotRef: before.context.currentWorkbenchSnapshotRef,
        workbenchCardRef: before.context.currentWorkbenchCardRef,
        operationRef: before.projection.operationRef,
        expectedProjectionRef: before.projection.projectionRef,
      },
      context: before.context,
    });
    await controlled.waitUntilBlocked();

    const cancelled = harness.service.cancel({
      request: {
        schemaVersion: 1,
        action: "cancel",
        workbenchSnapshotRef: before.context.currentWorkbenchSnapshotRef,
        workbenchCardRef: before.context.currentWorkbenchCardRef,
        operationRef: before.projection.operationRef,
        expectedProjectionRef: before.projection.projectionRef,
        reason: "owner_requested",
      },
      context: before.context,
    });
    const resumed = await resume;

    expect(cancelled.replayed).toBe(false);
    expect(resumed).toMatchObject({ operationRef: cancelled.operationRef, replayed: true });
    expect(controlled.signal()?.aborted).toBe(true);
    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(
      records.filter(
        (record) => record.recordKind === "page_atlas_attempt" && record.status === "cancelled"
      )
    ).toHaveLength(1);
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_version")).toHaveLength(
      atlasCountBefore
    );
  });

  it("does not abort an in-flight resume when the cancellation CAS loses", async () => {
    const controlled = abortableResumeParser();
    const harness = createHarness(roots, controlled.parser, 1);
    const before = await startAndReadGeneric(harness);
    const resume = harness.service.resume({
      request: {
        schemaVersion: 1,
        action: "resume",
        workbenchSnapshotRef: before.context.currentWorkbenchSnapshotRef,
        workbenchCardRef: before.context.currentWorkbenchCardRef,
        operationRef: before.projection.operationRef,
        expectedProjectionRef: before.projection.projectionRef,
      },
      context: before.context,
    });
    await controlled.waitUntilBlocked();
    harness.pageAtlasApply.mockImplementationOnce(() => {
      throw new ReferenceSourceStagingConflictError(
        "Injected losing cancellation CAS",
        harness.store.readHead()
      );
    });

    expect(() =>
      harness.service.cancel({
        request: {
          schemaVersion: 1,
          action: "cancel",
          workbenchSnapshotRef: before.context.currentWorkbenchSnapshotRef,
          workbenchCardRef: before.context.currentWorkbenchCardRef,
          operationRef: before.projection.operationRef,
          expectedProjectionRef: before.projection.projectionRef,
          reason: "owner_requested",
        },
        context: before.context,
      })
    ).toThrow(OwnerReferencePageAtlasStaleError);
    expect(controlled.signal()?.aborted).toBe(false);
    controlled.release();
    await expect(resume).resolves.toMatchObject({ replayed: false });
    const records = harness.store.readCurrentState()!.snapshot.records;
    expect(
      records.filter(
        (record) => record.recordKind === "page_atlas_attempt" && record.status === "cancelled"
      )
    ).toEqual([]);
  });
});

function createHarness(
  roots: string[],
  parser: ReferencePageAtlasParser = parserFixture(),
  resumeBatchPages = 2
) {
  const root = mkdtempSync(path.join(tmpdir(), "vellum-page-atlas-service-"));
  roots.push(root);
  const store = new ReferenceSourceStagingStore({ rootDirectory: root });
  let sequence = 0;
  const staging = new ReferenceSourceStagingService({
    store,
    now: () => new Date(NOW),
    createId: () => `page-atlas-unit-${++sequence}`,
  });
  const asset = record({
    recordKind: "digital_asset" as const,
    id: "asset.page-atlas-unit",
    sha256: createHash("sha256").update(PDF_BYTES).digest("hex"),
    mediaType: "application/pdf",
    byteLength: PDF_BYTES.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = record({
    recordKind: "asset_acquisition" as const,
    id: "acquisition.page-atlas-unit",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload" as const, ownerActionRef: externalRef("owner-action.unit") },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.unit"),
  }) as ReferenceAssetAcquisition;
  const seed: ReferenceSourceStagingTransaction = {
    schemaVersion: 1,
    id: "transaction.page-atlas-unit.seed",
    operations: [asset, acquisition].map((sourceRecord) => ({
      type: "append_record" as const,
      record: sourceRecord,
    })),
    submittedAt: NOW,
  };
  staging.applyTransaction(seed);
  const projector = new OwnerReferenceWorkbenchOpaqueProjector(new Uint8Array(32).fill(7));
  const card = projector.project("unit-card", "card");
  const basePageAtlasWriter = createReferenceSourcePageAtlasStagingWriter(staging);
  const pageAtlasApply = vi.fn(basePageAtlasWriter.applyTransaction);
  const service = new OwnerReferencePageAtlasService({
    localExtractionWriter: createOwnerLocalExtractionStagingWriter(staging),
    pageAtlasWriter: {
      readCurrent: basePageAtlasWriter.readCurrent,
      applyTransaction: pageAtlasApply,
    },
    stagingStore: store,
    controlledArtifacts: {
      readDigitalAssetBytes: () => new Uint8Array(PDF_BYTES),
    },
    parser,
    sourceProfileResolver: new ExactAssetReferencePageAtlasSourceProfileResolver([
      syntheticMaceSourceProfile(asset, 110),
    ]),
    opaqueProjector: projector,
    now: () => new Date(NOW),
    resumeBatchPages,
  });
  return {
    service,
    store,
    pageAtlasApply,
    context(version: number): OwnerReferencePageAtlasResolvedContext {
      const state = store.readCurrentState()!;
      return {
        currentWorkbenchSnapshotRef: projector.project("unit-snapshot", version),
        currentWorkbenchCardRef: card,
        currentStagingSnapshotRef: ref(state.snapshot),
        acquisition,
        digitalAsset: asset,
      };
    },
  };
}

function syntheticMaceSourceProfile(asset: ReferenceDigitalAsset, pageCount: number) {
  return defineMacePageAtlasSourceProfile({
    id: "source-profile.mace.synthetic-unit-fixture.v1",
    registryRef: externalRef("registry.reference-source-profile.synthetic-unit.v1"),
    evidenceRef: externalRef("fixture.synthetic-mace-unit.pdf"),
    exactAsset: {
      sha256: asset.sha256,
      byteLength: asset.byteLength,
      mediaType: "application/pdf",
      pageCount,
    },
    identity: {
      preferredTitle: "Synthetic Mace unit fixture",
      workDate: "1676",
      language: "en",
      claimantKind: "system",
    },
    atlas: {
      targetScanPage: 105,
      targetPrintedPage: "75",
      initialScanPages: [104, 105, 106],
      printedPageOffset: 30,
    },
    extraction: {
      originalTranscription: "a /a //a ///a 4 5",
      normalizedTranscription: "a /a //a ///a 4 5",
      mappings: [
        { course: 7, symbol: "a" },
        { course: 8, symbol: "/a" },
        { course: 9, symbol: "//a" },
        { course: 10, symbol: "///a" },
        { course: 11, symbol: "4" },
        { course: 12, symbol: "5" },
      ],
      regions: {
        text: { x: 0.103, y: 0.644, width: 0.655, height: 0.064 },
        notation: { x: 0.511, y: 0.554, width: 0.249, height: 0.085 },
      },
    },
  });
}

function startRequest(
  context: OwnerReferencePageAtlasResolvedContext,
  profile: "generic_paged_source" | "mace-musicks-monument-1676"
) {
  return {
    schemaVersion: 1 as const,
    action: "start" as const,
    workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
    workbenchCardRef: context.currentWorkbenchCardRef,
    purpose: "Build an exact local Page Atlas.",
    authorization: "owner_attested_local_extraction" as const,
    operationKey: OPERATION_KEY,
    profile,
    profileSelection: "owner_selected" as const,
  };
}

async function startAndReadGeneric(harness: ReturnType<typeof createHarness>) {
  const initialContext = harness.context(1);
  const receipt = await harness.service.start({
    request: startRequest(initialContext, "generic_paged_source"),
    context: initialContext,
  });
  const context = harness.context(2);
  const projection = harness.service.read({
    request: {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
      workbenchCardRef: context.currentWorkbenchCardRef,
      operationRef: receipt.operationRef,
    },
    context,
  });
  return { context, projection };
}

function correctionRequest(
  context: OwnerReferencePageAtlasResolvedContext,
  projection: ReturnType<OwnerReferencePageAtlasService["read"]>,
  printedLocator: string
) {
  return {
    schemaVersion: 1 as const,
    action: "correct_mapping" as const,
    workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
    workbenchCardRef: context.currentWorkbenchCardRef,
    operationRef: projection.operationRef,
    expectedProjectionRef: projection.projectionRef,
    correction: {
      scanPageNumber: 1,
      printedLocator,
      reason: `Bind the exact synthetic printed locator ${printedLocator}.`,
    },
  };
}

function resumeRequest(
  context: OwnerReferencePageAtlasResolvedContext,
  projection: ReturnType<OwnerReferencePageAtlasService["read"]>
) {
  return {
    schemaVersion: 1 as const,
    action: "resume" as const,
    workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
    workbenchCardRef: context.currentWorkbenchCardRef,
    operationRef: projection.operationRef,
    expectedProjectionRef: projection.projectionRef,
  };
}

function concurrentCorrectionParser() {
  let blocking = false;
  let blocked = 0;
  let release!: () => void;
  let bothBlocked!: () => void;
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bothBlockedPromise = new Promise<void>((resolve) => {
    bothBlocked = resolve;
  });
  const parser = parserFixture({
    renderPage: vi.fn(async ({ scanOrdinal }) => {
      if (blocking) {
        blocked += 1;
        if (blocked === 2) bothBlocked();
        await releasePromise;
      }
      return {
        schemaVersion: 1 as const,
        rendererId: "poppler.pdftoppm" as const,
        scanOrdinal,
        mediaType: "image/png" as const,
        widthPixels: 818,
        heightPixels: 1348,
        bytes: new Uint8Array([137, 80, 78, 71, scanOrdinal % 256]),
      };
    }),
  });
  return {
    parser,
    blockTwoCorrections: () => {
      blocking = true;
    },
    waitUntilBlocked: () => bothBlockedPromise,
    release,
  };
}

function abortableResumeParser() {
  let inspectCalls = 0;
  let blockedSignal: AbortSignal | undefined;
  let release!: () => void;
  let blocked!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const parser = parserFixture({
    inspect: vi.fn(async ({ signal }) => {
      inspectCalls += 1;
      if (inspectCalls === 1) return syntheticInspection(110);
      blockedSignal = signal;
      blocked();
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(new OwnerReferencePageAtlasInterruptionError());
        signal?.addEventListener("abort", abort, { once: true });
        void released.then(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        });
      });
      return syntheticInspection(110);
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    signal: () => blockedSignal,
    release,
  };
}

function resolvingAfterAbortResumeParser() {
  let inspectCalls = 0;
  let blockedSignal: AbortSignal | undefined;
  let release!: () => void;
  let blocked!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const parser = parserFixture({
    inspect: vi.fn(async ({ signal }) => {
      inspectCalls += 1;
      if (inspectCalls === 1) return syntheticInspection(110);
      blockedSignal = signal;
      blocked();
      await released;
      return syntheticInspection(110);
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    signal: () => blockedSignal,
    release,
  };
}

function resolvingAfterAbortCorrectionParser() {
  let renderCalls = 0;
  let blockedSignal: AbortSignal | undefined;
  let release!: () => void;
  let blocked!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const parser = parserFixture({
    renderPage: vi.fn(async ({ scanOrdinal, signal }) => {
      renderCalls += 1;
      if (renderCalls === 2) {
        blockedSignal = signal;
        blocked();
        await released;
      }
      return {
        schemaVersion: 1 as const,
        rendererId: "poppler.pdftoppm" as const,
        scanOrdinal,
        mediaType: "image/png" as const,
        widthPixels: 818,
        heightPixels: 1348,
        bytes: new Uint8Array([137, 80, 78, 71, scanOrdinal % 256]),
      };
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    signal: () => blockedSignal,
    release,
  };
}

function abortableFailedInitialRetryParser() {
  let inspectCalls = 0;
  let blocked!: () => void;
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const parser = parserFixture({
    inspect: vi.fn<ReferencePageAtlasParser["inspect"]>(async ({ signal }) => {
      inspectCalls += 1;
      if (inspectCalls === 1) throw new Error("synthetic initial parser failure");
      blocked();
      await new Promise<never>((_resolve, reject) => {
        const abort = () => reject(new OwnerReferencePageAtlasInterruptionError());
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
      return syntheticInspection(110);
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
  };
}

function resolvingAfterAbortFailedInitialRetryParser() {
  let inspectCalls = 0;
  let blockedSignal: AbortSignal | undefined;
  let release!: () => void;
  let blocked!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const parser = parserFixture({
    inspect: vi.fn<ReferencePageAtlasParser["inspect"]>(async ({ signal }) => {
      inspectCalls += 1;
      if (inspectCalls === 1) throw new Error("synthetic initial parser failure");
      blockedSignal = signal;
      blocked();
      await released;
      return syntheticInspection(110);
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    signal: () => blockedSignal,
    release,
  };
}

function lateFailureResumeParser() {
  let inspectCalls = 0;
  let blocked!: () => void;
  let fail!: () => void;
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const lateFailure = new Promise<never>((_resolve, reject) => {
    fail = () => reject(new Error("synthetic late resume parser failure"));
  });
  const parser = parserFixture({
    inspect: vi.fn(async () => {
      inspectCalls += 1;
      if (inspectCalls === 2) {
        blocked();
        await lateFailure;
      }
      return syntheticInspection(110);
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    fail,
  };
}

function lateFailureCorrectionParser() {
  let renderCalls = 0;
  let blocked!: () => void;
  let fail!: () => void;
  const becameBlocked = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  const lateFailure = new Promise<never>((_resolve, reject) => {
    fail = () => reject(new Error("synthetic late correction parser failure"));
  });
  const parser = parserFixture({
    renderPage: vi.fn(async ({ scanOrdinal }) => {
      renderCalls += 1;
      if (renderCalls === 2) {
        blocked();
        await lateFailure;
      }
      return {
        schemaVersion: 1 as const,
        rendererId: "poppler.pdftoppm" as const,
        scanOrdinal,
        mediaType: "image/png" as const,
        widthPixels: 818,
        heightPixels: 1348,
        bytes: new Uint8Array([137, 80, 78, 71, scanOrdinal % 256]),
      };
    }),
  });
  return {
    parser,
    waitUntilBlocked: () => becameBlocked,
    fail,
  };
}

function parserFixture(
  overrides: Partial<ReferencePageAtlasParser> = {}
): ReferencePageAtlasParser {
  return {
    describeRuntime: overrides.describeRuntime ?? vi.fn(async () => syntheticRuntimeIdentity()),
    inspect: overrides.inspect ?? vi.fn(async () => syntheticInspection(110)),
    renderPage:
      overrides.renderPage ??
      vi.fn(async ({ scanOrdinal }) => ({
        schemaVersion: 1 as const,
        rendererId: "poppler.pdftoppm" as const,
        scanOrdinal,
        mediaType: "image/png" as const,
        widthPixels: 818,
        heightPixels: 1348,
        bytes: new Uint8Array([137, 80, 78, 71, scanOrdinal % 256]),
      })),
  };
}

function syntheticRuntimeIdentity() {
  return {
    schemaVersion: 1 as const,
    interfaceId: "vellum.reference-page-atlas-parser.v1" as const,
    implementationId: "vellum.poppler-reference-page-atlas-parser.v1" as const,
    parser: {
      id: "poppler.pdfinfo" as const,
      executable: "pdfinfo" as const,
      artifact: "poppler" as const,
      version: "26.04.0-synthetic",
    },
    renderer: {
      id: "poppler.pdftoppm" as const,
      executable: "pdftoppm" as const,
      artifact: "poppler" as const,
      version: "26.04.0-synthetic",
    },
    schemas: {
      inspection: "vellum.reference-page-atlas-inspection.v1" as const,
      renderedPage: "vellum.reference-page-atlas-rendered-page.v1" as const,
      atlas: "vellum.reference-page-atlas-version.v1" as const,
      sourceSegment: "vellum.reference-source-segment-version.v1" as const,
      browserProjection: "vellum.reference-page-atlas-projection.v1" as const,
    },
    configuration: {
      limits: {
        maxInputBytes: 32 * 1024 * 1024,
        maxProcessAddressSpaceBytes: 768 * 1024 * 1024,
        maxOpenFiles: 64,
        maxPages: 2_048,
        maxPageWidthPoints: 2_880,
        maxPageHeightPoints: 2_880,
        maxPageAreaPointsSquared: 4_147_200,
        inspectTimeoutMs: 15_000,
        maxInspectOutputBytes: 2 * 1024 * 1024,
        renderTimeoutMs: 20_000,
        renderDpi: 144,
        maxRenderedWidthPixels: 4_096,
        maxRenderedHeightPixels: 4_096,
        maxRenderedPixels: 16_777_216,
        maxRenderedOutputBytes: 16 * 1024 * 1024,
        maxRenderDiagnosticBytes: 64 * 1024,
      },
    },
  };
}

function syntheticInspection(pageCount: number) {
  return {
    schemaVersion: 1 as const,
    parserId: "poppler.pdfinfo" as const,
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      scanOrdinal: index + 1,
      widthPoints: 409,
      heightPoints: 674,
      rotationDegrees: 0 as const,
    })),
  };
}

function record<T extends Record<string, unknown>>(core: T) {
  return withReferenceRecordDigest(core);
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}
