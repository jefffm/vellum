import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiResponse } from "../../src/lib/api-contract.js";
import type {
  ReferencePageAtlasOperationRequest,
  ReferencePageAtlasProjection,
  ReferencePageAtlasProfile,
} from "../../src/lib/reference-page-atlas-contract.js";
import type { OwnerReferenceWorkbenchSnapshot } from "../../src/lib/owner-reference-workbench-contract.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type OwnerReferenceBinding,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingRecord,
} from "../../src/lib/reference-source-domain.js";
import { createApp } from "../../src/server/index.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import { ReferenceSourceControlledArtifactStore } from "../../src/server/lib/reference-source-controlled-artifact-store.js";
import { OwnerReferencePageAtlasInterruptionError } from "../../src/server/lib/owner-reference-page-atlas-service.js";
import type { ReferenceSourceOperationResult } from "../../src/server/lib/reference-source-operation-gateway.js";
import type { ReferenceSourceProtectedOperationSinks } from "../../src/server/lib/reference-source-protected-operation-adapter.js";
import {
  PopplerReferencePageAtlasParser,
  ReferencePageAtlasParserError,
  type ReferencePageAtlasInspection,
  type ReferencePageAtlasParser,
  type ReferencePageAtlasRenderedPage,
} from "../../src/server/lib/reference-page-atlas-parser.js";
import {
  ExactAssetReferencePageAtlasSourceProfileResolver,
  defineMacePageAtlasSourceProfile,
} from "../../src/server/lib/reference-page-atlas-source-profile.js";
import { ReferenceSourceStagingService } from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";
import { buildSyntheticPagedPdf } from "../support/synthetic-paged-pdf.js";

const NOW = "2026-07-16T12:00:00.000Z";
const PAGE_ATLAS_PATH = "/api/owner/reference-source-workbench/page-atlas";
const PREVIEW_PATH = `${PAGE_ATLAS_PATH}/preview`;
const LOCAL_EXTRACTION_PURPOSE =
  "Build a bounded local Page Atlas and stage cited extraction candidates for Owner review";
const SYNTHETIC_SOURCE_CANARY = "T11_SYNTHETIC_SOURCE_CONTENT_MUST_STAY_LOCAL";
const SYNTHETIC_DIAGNOSTIC_CANARY = "T11_SYNTHETIC_PARSER_DIAGNOSTIC_MUST_BE_REDACTED";

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("T11 Mace Page Atlas and cited-segment production boundary", () => {
  it("recovers a committed start after its HTTP response is lost and the Workbench advances", async () => {
    const bytes = buildSyntheticPagedPdf({
      pageCount: 110,
      citedPage: 105,
      citedText: `Synthetic fixture: a /a //a ///a 4 5 ${SYNTHETIC_SOURCE_CANARY}`,
    });
    const parser = deterministicParser(110);
    const harness = await createHarness({ bytes, parser, key: "lost-start-response" });
    const originalWorkbench = await readWorkbench(harness.base);
    const originalRequest = startBody(
      originalWorkbench,
      onlyCard(originalWorkbench).cardRef,
      operationKey("lost-start-response"),
      "mace-musicks-monument-1676"
    );

    // The server commits this request, but the simulated client discards the
    // response before it can persist operationRef.
    const committedResult = await postAtlas(harness.base, originalRequest);
    expect(committedResult.response.status).toBe(200);
    const committed = requireOk(committedResult.json);

    const successorWorkbench = await readWorkbench(harness.base);
    const successorCard = onlyCard(successorWorkbench);
    const recoveredResult = await postAtlas(harness.base, {
      ...originalRequest,
      workbenchSnapshotRef: successorWorkbench.snapshotRef,
      workbenchCardRef: successorCard.cardRef,
    });

    expect(recoveredResult.response.status).toBe(200);
    expect(requireOk(recoveredResult.json)).toEqual(committed);
    expect(parser.describeRuntime).toHaveBeenCalledTimes(1);
    expect(parser.inspect).toHaveBeenCalledTimes(1);
    expect(parser.renderPage).toHaveBeenCalledTimes(1);
    expect(
      currentRecords(harness.runtime.staging).filter(
        ({ recordKind }) => recordKind === "page_atlas_attempt"
      )
    ).toHaveLength(1);
  });

  it("returns one success and one conflict for concurrent corrections with different record digests", async () => {
    const bytes = buildSyntheticPagedPdf({
      pageCount: 3,
      citedPage: 1,
      citedText: SYNTHETIC_SOURCE_CANARY,
    });
    const parser = deterministicParser(3);
    const harness = await createHarness({ bytes, parser, key: "concurrent-corrections" });
    const workbench = await readWorkbench(harness.base);
    const startedResult = await postAtlas(
      harness.base,
      startBody(
        workbench,
        onlyCard(workbench).cardRef,
        operationKey("concurrent-corrections"),
        "generic_paged_source"
      )
    );
    expect(startedResult.response.status).toBe(200);
    const started = requireOk(startedResult.json);

    let blocked = 0;
    let release!: () => void;
    let bothBlocked!: () => void;
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const bothBlockedPromise = new Promise<void>((resolve) => {
      bothBlocked = resolve;
    });
    parser.renderPage.mockImplementation(async ({ scanOrdinal }) => {
      blocked += 1;
      if (blocked === 2) bothBlocked();
      await releasePromise;
      return {
        schemaVersion: 1,
        rendererId: "poppler.pdftoppm",
        scanOrdinal,
        mediaType: "image/png",
        widthPixels: 818,
        heightPixels: 1_348,
        bytes: renderedPng(scanOrdinal),
      };
    });
    const correction = {
      schemaVersion: 1 as const,
      action: "correct_mapping" as const,
      workbenchSnapshotRef: started.workbenchSnapshotRef,
      workbenchCardRef: started.workbenchCardRef,
      operationRef: started.operationRef,
      expectedProjectionRef: started.projectionRef,
      correction: {
        scanPageNumber: 1,
        printedLocator: "frontispiece",
        reason: "Bind the synthetic frontispiece locator.",
      },
    };
    const first = postAtlas(harness.base, correction);
    const second = postAtlas(harness.base, {
      ...correction,
      correction: {
        ...correction.correction,
        printedLocator: "folio ii",
        reason: "Bind the different synthetic folio locator.",
      },
    });
    await bothBlockedPromise;
    release();
    const results = await Promise.all([first, second]);

    expect(results.map(({ response }) => response.status).sort()).toEqual([200, 409]);
    const conflict = results.find(({ response }) => response.status === 409)!;
    expect(conflict.json).toMatchObject({
      ok: false,
      error: { code: "conflict", status: 409 },
    });
    const records = currentRecords(harness.runtime.staging);
    expect(records.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(
      1
    );
    expect(records.filter(({ recordKind }) => recordKind === "citation_successor")).toHaveLength(1);
  });

  it("aborts an in-flight resume and commits one immutable cancellation checkpoint", async () => {
    const bytes = buildSyntheticPagedPdf({
      pageCount: 3,
      citedPage: 1,
      citedText: SYNTHETIC_SOURCE_CANARY,
    });
    const parser = deterministicParser(3);
    const harness = await createHarness({ bytes, parser, key: "in-flight-cancel" });
    const workbench = await readWorkbench(harness.base);
    const startedResult = await postAtlas(
      harness.base,
      startBody(
        workbench,
        onlyCard(workbench).cardRef,
        operationKey("in-flight-cancel"),
        "generic_paged_source"
      )
    );
    expect(startedResult.response.status).toBe(200);
    const started = requireOk(startedResult.json);

    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    parser.inspect.mockImplementationOnce(
      (input: Readonly<{ bytes: Uint8Array; signal?: AbortSignal }>) =>
        new Promise<ReferencePageAtlasInspection>((_resolve, reject) => {
          observedSignal = input.signal;
          entered();
          const abort = () => reject(new ReferencePageAtlasParserError("parser_cancelled"));
          if (input.signal?.aborted) abort();
          else input.signal?.addEventListener("abort", abort, { once: true });
        })
    );
    const resumePromise = postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: started.workbenchSnapshotRef,
      workbenchCardRef: started.workbenchCardRef,
      operationRef: started.operationRef,
      expectedProjectionRef: started.projectionRef,
    });
    await enteredPromise;
    const cancelledResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "cancel",
      workbenchSnapshotRef: started.workbenchSnapshotRef,
      workbenchCardRef: started.workbenchCardRef,
      operationRef: started.operationRef,
      expectedProjectionRef: started.projectionRef,
      reason: "owner_requested",
    });
    const resumedResult = await resumePromise;

    expect(observedSignal?.aborted).toBe(true);
    expect(cancelledResult.response.status).toBe(200);
    expect(resumedResult.response.status).toBe(200);
    expect(requireOk(cancelledResult.json).atlas.state).toBe("cancelled");
    expect(requireOk(resumedResult.json).atlas.state).toBe("cancelled");
    const attempts = currentRecords(harness.runtime.staging).filter(
      ({ recordKind }) => recordKind === "page_atlas_attempt"
    );
    expect(attempts).toHaveLength(2);
    expect(attempts.at(-1)).toMatchObject({ status: "cancelled", failureCode: "cancelled" });
  });

  it("carries a synthetic Mace-profile source through exact staging and refuses non-immutable preview regeneration", async () => {
    const bytes = buildSyntheticPagedPdf({
      pageCount: 110,
      citedPage: 105,
      citedText: `Synthetic fixture: a /a //a ///a 4 5 ${SYNTHETIC_SOURCE_CANARY}`,
    });
    const parser = deterministicParser(110);
    const sinks = protectedSinkSpies();
    const harness = await createHarness({ bytes, parser, sinks, key: "mace-main" });
    const initialWorkbench = await readWorkbench(harness.base);
    const card = onlyCard(initialWorkbench);
    const startRequest = startBody(
      initialWorkbench,
      card.cardRef,
      operationKey("mace-main"),
      "mace-musicks-monument-1676"
    );

    const started = await postAtlas(harness.base, startRequest);
    expect(started.response.status).toBe(200);
    const initial = requireOk(started.json);
    expect(initial).toMatchObject({
      schemaVersion: 1,
      profile: "mace-musicks-monument-1676",
      profileSelection: "owner_selected",
      publicationState: "staging_only",
      authorityState: "non_authoritative",
      boundary: {
        processing: "local_only",
        authorization: "owner_attested_local_extraction",
        network: "disabled",
        providerEgress: "deny",
        fixtureInclusion: "deny",
        repositoryInclusion: "deny",
        export: "deny",
        redistribution: "deny",
      },
      atlas: {
        version: 1,
        state: "paused",
        coverage: {
          enumeratedPages: 3,
          rasterObservedPages: 1,
          contentCandidatePages: 1,
          mappingReviewedPages: 0,
          totalPages: 110,
          remainingPages: 107,
          completeness: "partial",
        },
        stop: null,
      },
      target: {
        scanPageNumber: 105,
        printedLocator: { state: "known", value: "75" },
        mappingState: "candidate",
      },
      stagedKnowledge: {
        kind: "mace_twelve_course_diapason_notation",
        reviewState: "staged",
        authorityState: "non_authoritative",
        profileScope: "mace-musicks-monument-1676",
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
          authorityState: "non_authoritative",
          question:
            "Which directly applicable historical source establishes the thirteenth-course sign?",
        },
      },
    });
    expect(initial.atlas.coverage.percentComplete).toBeCloseTo(2.73, 2);
    expect(initial.citedSegmentLineage.versions).toHaveLength(1);
    expect(initial.citedSegmentLineage.versions[0]).toMatchObject({
      version: 1,
      parentSegmentRef: null,
      successorSegmentRef: null,
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "75" },
      mappingState: "candidate",
      citationState: "immutable",
      authorityState: "non_authoritative",
    });
    expect(initial.citedSegmentLineage.versions[0]!.anchors.map(({ kind }) => kind)).toEqual([
      "image",
      "text",
      "notation",
    ]);
    expect(initial.citedSegmentLineage.versions[0]!.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewState: "candidate", contentState: "withheld_local_only" }),
      ])
    );
    assertSeparateUncertaintyDimensions(initial);
    assertNoSourceLeak(initial, harness.upload, bytes, SYNTHETIC_SOURCE_CANARY);
    expect(parser.inspect).toHaveBeenCalled();
    expect(parser.renderPage).toHaveBeenCalledWith(
      expect.objectContaining({ scanOrdinal: 105, bytes: expect.any(Uint8Array) })
    );
    expect(Buffer.from(parser.inspect.mock.calls[0]![0].bytes)).toEqual(bytes);
    for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();

    const stagedAfterStart = currentRecords(harness.runtime.staging);
    assertMaceCanonicalGraph(stagedAfterStart, harness.upload, LOCAL_EXTRACTION_PURPOSE);

    // A verbatim retry is idempotent even though the original Workbench
    // snapshot is now stale; the operation key remains bound to this exact
    // purpose, profile, card, and source.
    const exactStartReplay = await postAtlas(harness.base, startRequest);
    expect(exactStartReplay.response.status).toBe(200);
    expect(requireOk(exactStartReplay.json)).toEqual(initial);
    expect(parser.inspect).toHaveBeenCalledTimes(1);

    const conflictingStart = await postAtlas(harness.base, {
      ...startRequest,
      purpose: "A different local purpose must not reuse the exact operation key",
    });
    expect(conflictingStart.response.status).toBe(409);
    expect(conflictingStart.json).toMatchObject({
      ok: false,
      error: { code: "conflict", status: 409 },
    });
    assertNoSourceLeak(conflictingStart.json, harness.upload, bytes, SYNTHETIC_SOURCE_CANARY);

    const originalSegment = initial.citedSegmentLineage.versions[0]!;
    expect(originalSegment.previewState).toBe("regeneration_unavailable");
    const originalPreview = await preview(harness.base, initial, originalSegment.segmentRef);
    assertRegenerationUnavailable(originalPreview.response, originalPreview.bytes);
    expect(parser.renderPage).toHaveBeenCalledTimes(1);

    const movedExtraction = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "correct_mapping",
      workbenchSnapshotRef: initial.workbenchSnapshotRef,
      workbenchCardRef: initial.workbenchCardRef,
      operationRef: initial.operationRef,
      expectedProjectionRef: initial.projectionRef,
      correction: {
        scanPageNumber: 104,
        printedLocator: "frontispiece",
        reason: "A locator correction must not clone an extraction onto a different scan.",
      },
    });
    expect(movedExtraction.response.status).toBe(200);
    const moved = requireOk(movedExtraction.json);
    expect(moved.atlas).toMatchObject({ version: 2, state: "paused" });
    expect(moved.target).toMatchObject({
      scanPageNumber: 104,
      printedLocator: { state: "known", value: "frontispiece" },
      mappingState: "corrected",
      pageState: { contentExtraction: "not_extracted" },
    });
    expect(moved.stagedKnowledge).toEqual({
      kind: "none",
      reason: "reextraction_required",
    });
    expect(moved.citedSegmentLineage.versions).toHaveLength(2);
    expect(moved.citedSegmentLineage.versions[0]!.anchors.map(({ kind }) => kind)).toEqual([
      "image",
      "text",
      "notation",
    ]);
    expect(moved.citedSegmentLineage.versions[1]!.anchors.map(({ kind }) => kind)).toEqual([
      "image",
    ]);
    expect(parser.renderPage).toHaveBeenCalledTimes(2);
    assertMovedScanRequiresReextraction(stagedAfterStart, currentRecords(harness.runtime.staging));

    const correctedResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "correct_mapping",
      workbenchSnapshotRef: moved.workbenchSnapshotRef,
      workbenchCardRef: moved.workbenchCardRef,
      operationRef: moved.operationRef,
      expectedProjectionRef: moved.projectionRef,
      correction: {
        scanPageNumber: 105,
        printedLocator: "76",
        reason: "The synthetic fixture corrects the printed locator on the same cited scan.",
      },
    });
    expect(correctedResult.response.status).toBe(200);
    const corrected = requireOk(correctedResult.json);
    expect(corrected.atlas).toMatchObject({ version: 3, state: "paused" });
    expect(corrected.target).toMatchObject({
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "76" },
      mappingState: "corrected",
    });
    expect(corrected.citedSegmentLineage.versions).toHaveLength(3);
    const [preserved, movedImageOnly, successor] = corrected.citedSegmentLineage.versions;
    expect(preserved).toMatchObject({
      version: 1,
      parentSegmentRef: null,
      successorSegmentRef: movedImageOnly!.segmentRef,
      scanPageNumber: 105,
      mappingState: "candidate",
      citationState: "immutable",
    });
    expect(movedImageOnly).toMatchObject({
      version: 2,
      parentSegmentRef: preserved!.segmentRef,
      successorSegmentRef: successor!.segmentRef,
      scanPageNumber: 104,
      printedLocator: { state: "known", value: "frontispiece" },
      mappingState: "corrected",
      citationState: "immutable",
    });
    expect(movedImageOnly!.anchors.map(({ kind }) => kind)).toEqual(["image"]);
    expect(successor).toMatchObject({
      version: 3,
      parentSegmentRef: movedImageOnly!.segmentRef,
      successorSegmentRef: null,
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "76" },
      mappingState: "corrected",
      citationState: "immutable",
      authorityState: "non_authoritative",
      previewState: "regeneration_unavailable",
    });
    expect(corrected.citedSegmentLineage.currentSegmentRef).toEqual(successor!.segmentRef);

    // Both historical citation versions remain resolvable under the current
    // projection; correcting a locator never rewrites the first segment.
    const preservedPreview = await preview(harness.base, corrected, preserved!.segmentRef);
    const movedPreview = await preview(harness.base, corrected, movedImageOnly!.segmentRef);
    const successorPreview = await preview(harness.base, corrected, successor!.segmentRef);
    assertRegenerationUnavailable(preservedPreview.response, preservedPreview.bytes);
    assertRegenerationUnavailable(movedPreview.response, movedPreview.bytes);
    assertRegenerationUnavailable(successorPreview.response, successorPreview.bytes);
    expect(parser.renderPage).toHaveBeenCalledTimes(3);

    const stagedAfterCorrection = currentRecords(harness.runtime.staging);
    assertImmutableCorrectionGraph(stagedAfterStart, stagedAfterCorrection);

    const staleRead = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: initial.workbenchSnapshotRef,
      workbenchCardRef: initial.workbenchCardRef,
      operationRef: initial.operationRef,
    });
    expect(staleRead.response.status).toBe(409);
    expect(staleRead.json).toMatchObject({
      ok: false,
      error: { code: "conflict", status: 409 },
    });

    const readCurrent = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: corrected.workbenchSnapshotRef,
      workbenchCardRef: corrected.workbenchCardRef,
      operationRef: corrected.operationRef,
    });
    expect(readCurrent.response.status).toBe(200);
    expect(requireOk(readCurrent.json)).toEqual(corrected);

    const resumedResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: corrected.workbenchSnapshotRef,
      workbenchCardRef: corrected.workbenchCardRef,
      operationRef: corrected.operationRef,
      expectedProjectionRef: corrected.projectionRef,
    });
    expect(resumedResult.response.status).toBe(200);
    const resumed = requireOk(resumedResult.json);
    expect(resumed.atlas).toMatchObject({
      version: 4,
      state: "paused",
      coverage: { enumeratedPages: 11, totalPages: 110, remainingPages: 99 },
    });

    const staleResume = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: corrected.workbenchSnapshotRef,
      workbenchCardRef: corrected.workbenchCardRef,
      operationRef: corrected.operationRef,
      expectedProjectionRef: corrected.projectionRef,
    });
    expect(staleResume.response.status).toBe(409);

    const cancelledResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "cancel",
      workbenchSnapshotRef: resumed.workbenchSnapshotRef,
      workbenchCardRef: resumed.workbenchCardRef,
      operationRef: resumed.operationRef,
      expectedProjectionRef: resumed.projectionRef,
      reason: "owner_requested",
    });
    expect(cancelledResult.response.status).toBe(200);
    const cancelled = requireOk(cancelledResult.json);
    expect(cancelled.atlas).toMatchObject({
      state: "cancelled",
      coverage: { completeness: "partial" },
      stop: { reason: "owner_cancelled", diagnostics: "redacted" },
    });

    const cancelReplay = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "cancel",
      workbenchSnapshotRef: cancelled.workbenchSnapshotRef,
      workbenchCardRef: cancelled.workbenchCardRef,
      operationRef: cancelled.operationRef,
      expectedProjectionRef: cancelled.projectionRef,
      reason: "owner_requested",
    });
    expect(cancelReplay.response.status).toBe(200);
    expect(requireOk(cancelReplay.json)).toEqual(cancelled);

    const resumeAfterCancel = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: cancelled.workbenchSnapshotRef,
      workbenchCardRef: cancelled.workbenchCardRef,
      operationRef: cancelled.operationRef,
      expectedProjectionRef: cancelled.projectionRef,
    });
    expect(resumeAfterCancel.response.status).toBe(409);

    const deniedEgress = await jsonRequest<ReferenceSourceOperationResult>(
      `${harness.base}/api/owner/reference-source-operations/execute`,
      {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: 1,
          acquisitionRef: ref(harness.upload.acquisition),
          operation: "provider_model_processing",
          destination: { kind: "provider", id: "provider.fake-t11" },
          purpose: "Attempted Page Atlas provider egress must fail closed",
        }),
      }
    );
    expect(deniedEgress.response.status).toBe(200);
    expect(requireOk(deniedEgress.json)).toMatchObject({
      operation: "provider_model_processing",
      status: "deny",
      reasonCode: "owner_private_default_denied",
    });
    for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();
    assertNoSourceLeak(cancelled, harness.upload, bytes, SYNTHETIC_SOURCE_CANARY);
    // The older protected-operation API intentionally echoes its canonical
    // acquisition ID, but still cannot disclose bytes, content identity, or
    // source-bearing diagnostics when it denies the operation before effects.
    expect(JSON.stringify(deniedEgress.json)).not.toContain(harness.upload.digitalAsset.sha256);
    expect(JSON.stringify(deniedEgress.json)).not.toContain(harness.upload.digitalAsset.digest);
    expect(JSON.stringify(deniedEgress.json)).not.toContain(SYNTHETIC_SOURCE_CANARY);
  });

  it("does not turn an unrelated same-length Page Atlas into Mace identity or notation", async () => {
    const registeredBytes = buildSyntheticPagedPdf({
      pageCount: 110,
      citedPage: 105,
      citedText: "Self-authored registered source: a /a //a ///a 4 5",
    });
    const unrelatedBytes = buildSyntheticPagedPdf({
      pageCount: 110,
      citedPage: 105,
      citedText: `Unrelated source with no historical claim ${SYNTHETIC_SOURCE_CANARY}`,
    });
    const parser = deterministicParser(110);
    const harness = await createHarness({
      bytes: unrelatedBytes,
      sourceProfileBytes: registeredBytes,
      parser,
      key: "unrelated-mace-profile",
    });
    const workbench = await readWorkbench(harness.base);
    const result = await postAtlas(
      harness.base,
      startBody(
        workbench,
        onlyCard(workbench).cardRef,
        operationKey("unrelated-mace-profile"),
        "mace-musicks-monument-1676"
      )
    );

    expect(result.response.status).toBe(422);
    expect(result.json).toMatchObject({
      ok: false,
      error: { code: "unprocessable_content", status: 422 },
    });
    expect(parser.inspect).toHaveBeenCalledTimes(1);
    expect(parser.renderPage).not.toHaveBeenCalled();
    expect(
      currentRecords(harness.runtime.staging).filter(({ recordKind }) =>
        [
          "work",
          "source_manifestation",
          "exemplar",
          "identity_assertion",
          "asset_identity_resolution",
          "page_atlas_version",
          "source_segment_version",
          "cited_extraction_version",
          "extraction_proposal",
        ].includes(recordKind)
      )
    ).toEqual([]);
    assertNoSourceLeak(result.json, harness.upload, unrelatedBytes, SYNTHETIC_SOURCE_CANARY);
  });

  it("keeps the generic profile image-only and creates honest successor citations without fabricating Mace knowledge", async () => {
    const bytes = buildSyntheticPagedPdf({
      pageCount: 3,
      citedPage: 2,
      citedText: `Generic synthetic source ${SYNTHETIC_SOURCE_CANARY}`,
    });
    const parser = deterministicParser(3);
    const harness = await createHarness({ bytes, parser, key: "generic-main" });
    const workbench = await readWorkbench(harness.base);
    const startedResult = await postAtlas(
      harness.base,
      startBody(
        workbench,
        onlyCard(workbench).cardRef,
        operationKey("generic-main"),
        "generic_paged_source"
      )
    );
    expect(startedResult.response.status).toBe(200);
    const started = requireOk(startedResult.json);
    expect(started).toMatchObject({
      profile: "generic_paged_source",
      authorityState: "non_authoritative",
      atlas: {
        state: "paused",
        coverage: { enumeratedPages: 1, totalPages: 3, remainingPages: 2 },
      },
      target: {
        scanPageNumber: 1,
        printedLocator: { state: "unresolved" },
        mappingState: "unresolved",
      },
      stagedKnowledge: { kind: "none", reason: "generic_profile_has_no_seed" },
    });
    expect(started.citedSegmentLineage.versions).toHaveLength(1);
    expect(started.citedSegmentLineage.versions[0]!.anchors.map(({ kind }) => kind)).toEqual([
      "image",
    ]);

    // Correction is citation maintenance, not an implicit extraction command:
    // an unprocessed page fails closed without invoking the parser or changing
    // the graph. Resume must establish the canvas first.
    const recordsBeforeRejectedCorrection = currentRecords(harness.runtime.staging);
    const inspectCallsBeforeRejectedCorrection = parser.inspect.mock.calls.length;
    const renderCallsBeforeRejectedCorrection = parser.renderPage.mock.calls.length;
    const rejectedCorrection = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "correct_mapping",
      workbenchSnapshotRef: started.workbenchSnapshotRef,
      workbenchCardRef: started.workbenchCardRef,
      operationRef: started.operationRef,
      expectedProjectionRef: started.projectionRef,
      correction: {
        scanPageNumber: 2,
        printedLocator: "frontispiece",
        reason: "The self-authored generic fixture labels scan page 2 as its frontispiece.",
      },
    });
    expect(rejectedCorrection.response.status).toBe(422);
    expect(rejectedCorrection.json).toMatchObject({
      ok: false,
      error: { code: "unprocessable_content", status: 422 },
    });
    expect(currentRecords(harness.runtime.staging)).toEqual(recordsBeforeRejectedCorrection);
    expect(parser.inspect).toHaveBeenCalledTimes(inspectCallsBeforeRejectedCorrection);
    expect(parser.renderPage).toHaveBeenCalledTimes(renderCallsBeforeRejectedCorrection);

    // The already-processed first canvas can be corrected. Its image-only
    // successor does not inherit Mace-specific extraction state, and a textual
    // locator deliberately exercises the optional numeric-ordinal path.
    const correctedResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "correct_mapping",
      workbenchSnapshotRef: started.workbenchSnapshotRef,
      workbenchCardRef: started.workbenchCardRef,
      operationRef: started.operationRef,
      expectedProjectionRef: started.projectionRef,
      correction: {
        scanPageNumber: 1,
        printedLocator: "frontispiece",
        reason: "The self-authored generic fixture labels its first scan page as a frontispiece.",
      },
    });
    expect(correctedResult.response.status).toBe(200);
    const corrected = requireOk(correctedResult.json);
    expect(corrected.atlas).toMatchObject({ version: 2, state: "paused" });
    expect(corrected.target).toMatchObject({
      scanPageNumber: 1,
      printedLocator: { state: "known", value: "frontispiece" },
      mappingState: "corrected",
    });
    expect(corrected.citedSegmentLineage.versions).toHaveLength(2);
    expect(
      corrected.citedSegmentLineage.versions.every(({ anchors }) => anchors.length === 1)
    ).toBe(true);
    expect(
      corrected.citedSegmentLineage.versions.flatMap(({ anchors }) =>
        anchors.map(({ kind }) => kind)
      )
    ).toEqual(["image", "image"]);
    expect(corrected.stagedKnowledge).toEqual({
      kind: "none",
      reason: "generic_profile_has_no_seed",
    });

    const recordsAfterCorrection = currentRecords(harness.runtime.staging);
    expect(
      recordsAfterCorrection.filter(({ recordKind }) => recordKind === "cited_extraction_version")
    ).toEqual([]);
    expect(
      recordsAfterCorrection.filter(({ recordKind }) => recordKind === "extraction_proposal")
    ).toEqual([]);
    const genericSuccessor = recordsAfterCorrection.find(
      ({ recordKind }) => recordKind === "citation_successor"
    );
    expect(genericSuccessor).toMatchObject({
      recordKind: "citation_successor",
      priorCitedExtractionRefs: [],
      successorCitedExtractionRefs: [],
    });

    // A typed process interruption commits an immutable checkpoint and a
    // redacted attempt. The next exact resume continues from that checkpoint.
    parser.inspect.mockRejectedValueOnce(new OwnerReferencePageAtlasInterruptionError());
    const interruptedResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: corrected.workbenchSnapshotRef,
      workbenchCardRef: corrected.workbenchCardRef,
      operationRef: corrected.operationRef,
      expectedProjectionRef: corrected.projectionRef,
    });
    expect(interruptedResult.response.status).toBe(200);
    const interrupted = requireOk(interruptedResult.json);
    expect(interrupted.atlas).toMatchObject({
      version: 3,
      state: "paused",
      coverage: { enumeratedPages: 1, totalPages: 3, remainingPages: 2 },
      stop: { reason: "interrupted", diagnostics: "redacted" },
    });
    const interruptedAttempt = currentRecords(harness.runtime.staging).find(
      (record) => record.recordKind === "page_atlas_attempt" && record.status === "interrupted"
    );
    expect(interruptedAttempt).toMatchObject({
      recordKind: "page_atlas_attempt",
      attemptKind: "resume",
      status: "interrupted",
      failureCode: "interrupted",
    });

    const resumedResult = await postAtlas(harness.base, {
      schemaVersion: 1,
      action: "resume",
      workbenchSnapshotRef: interrupted.workbenchSnapshotRef,
      workbenchCardRef: interrupted.workbenchCardRef,
      operationRef: interrupted.operationRef,
      expectedProjectionRef: interrupted.projectionRef,
    });
    expect(resumedResult.response.status).toBe(200);
    const complete = requireOk(resumedResult.json);
    expect(complete.atlas).toMatchObject({
      version: 4,
      state: "complete",
      coverage: {
        enumeratedPages: 3,
        rasterObservedPages: 1,
        contentCandidatePages: 0,
        mappingReviewedPages: 1,
        totalPages: 3,
        remainingPages: 0,
        percentComplete: 100,
        completeness: "complete",
      },
      checkpointRef: null,
      stop: null,
    });
    expect(complete.target).toMatchObject({
      scanPageNumber: 1,
      printedLocator: { state: "known", value: "frontispiece" },
      mappingState: "corrected",
    });
    expect(complete.stagedKnowledge).toEqual({
      kind: "none",
      reason: "generic_profile_has_no_seed",
    });
    assertNoSourceLeak(complete, harness.upload, bytes, SYNTHETIC_SOURCE_CANARY);
  });

  it("persists redacted parser failure and resource exhaustion attempts, then resumes only by exact retry", async () => {
    const bytes = buildSyntheticPagedPdf({ pageCount: 110, citedText: SYNTHETIC_SOURCE_CANARY });
    const parser = deterministicParser(110);
    parser.inspect.mockRejectedValueOnce(
      new Error(`${SYNTHETIC_DIAGNOSTIC_CANARY} /synthetic/local/path/source.pdf`)
    );
    const harness = await createHarness({ bytes, parser, key: "parser-retry" });
    const workbench = await readWorkbench(harness.base);
    const startRequest = startBody(
      workbench,
      onlyCard(workbench).cardRef,
      operationKey("parser-retry"),
      "mace-musicks-monument-1676"
    );

    const failedResult = await postAtlas(harness.base, startRequest);
    expect(failedResult.response.status).toBe(200);
    const failed = requireOk(failedResult.json);
    expect(failed).toMatchObject({
      atlas: {
        state: "failed",
        coverage: {
          enumeratedPages: 0,
          rasterObservedPages: 0,
          contentCandidatePages: 0,
          mappingReviewedPages: 0,
          totalPages: null,
          remainingPages: null,
          percentComplete: null,
          completeness: "partial",
        },
        stop: { reason: "parser_failure", diagnostics: "redacted" },
      },
      stagedKnowledge: { kind: "none", reason: "source_unavailable" },
      citedSegmentLineage: { currentSegmentRef: null, versions: [] },
    });
    expect(JSON.stringify(failed)).not.toContain(SYNTHETIC_DIAGNOSTIC_CANARY);
    expect(JSON.stringify(failed)).not.toContain("/synthetic/local/path/source.pdf");
    const failedAttempt = currentRecords(harness.runtime.staging).find(
      ({ recordKind }) => recordKind === "page_atlas_attempt"
    );
    expect(failedAttempt).toMatchObject({
      recordKind: "page_atlas_attempt",
      attemptKind: "initial",
      status: "failed",
      failureCode: "parser_failure",
    });
    expect(JSON.stringify(failedAttempt)).not.toContain(SYNTHETIC_DIAGNOSTIC_CANARY);

    const retryResult = await postAtlas(harness.base, startRequest);
    expect(retryResult.response.status).toBe(200);
    const recovered = requireOk(retryResult.json);
    expect(recovered).toMatchObject({
      atlas: { state: "paused", coverage: { enumeratedPages: 3, totalPages: 110 } },
      stagedKnowledge: { kind: "mace_twelve_course_diapason_notation" },
    });
    const attemptsAfterRetry = currentRecords(harness.runtime.staging).filter(
      ({ recordKind }) => recordKind === "page_atlas_attempt"
    );
    expect(attemptsAfterRetry).toHaveLength(2);
    expect(
      attemptsAfterRetry.map(
        (attempt) => attempt.recordKind === "page_atlas_attempt" && attempt.status
      )
    ).toEqual(["failed", "completed"]);

    const oversizedRunner = { run: vi.fn() };
    const oversizedParser = new PopplerReferencePageAtlasParser({
      runner: oversizedRunner,
      limits: { maxInputBytes: 16 },
    });
    const oversizedHarness = await createHarness({
      bytes,
      parser: oversizedParser,
      key: "parser-resource-limit",
    });
    const oversizedWorkbench = await readWorkbench(oversizedHarness.base);
    const exhaustedResult = await postAtlas(
      oversizedHarness.base,
      startBody(
        oversizedWorkbench,
        onlyCard(oversizedWorkbench).cardRef,
        operationKey("parser-resource-limit"),
        "mace-musicks-monument-1676"
      )
    );
    expect(exhaustedResult.response.status).toBe(200);
    expect(requireOk(exhaustedResult.json)).toMatchObject({
      atlas: {
        state: "failed",
        stop: { reason: "resource_limit", diagnostics: "redacted" },
      },
      stagedKnowledge: { kind: "none", reason: "source_unavailable" },
    });
    expect(oversizedRunner.run).not.toHaveBeenCalled();
    expect(
      currentRecords(oversizedHarness.runtime.staging).find(
        ({ recordKind }) => recordKind === "page_atlas_attempt"
      )
    ).toMatchObject({ status: "resource_exhausted", failureCode: "resource_limit" });

    // The public upload boundary independently rejects an oversized declared
    // body before allocating, staging, or invoking a parser.
    const rejectedUpload = await oversizedHeaderUpload(oversizedHarness.base);
    expect(rejectedUpload.status).toBe(413);
    expect(rejectedUpload.json).toMatchObject({
      ok: false,
      error: { code: "request_too_large", status: 413 },
    });
    expect(oversizedRunner.run).not.toHaveBeenCalled();
    assertNoSourceLeak(
      { failed, recovered, exhausted: exhaustedResult.json, rejectedUpload },
      harness.upload,
      bytes,
      SYNTHETIC_SOURCE_CANARY,
      SYNTHETIC_DIAGNOSTIC_CANARY
    );
  });

  it("renders imported markup as inert withheld data and rejects forged browser authority fields", async () => {
    const markup = "<script>globalThis.__t11Injected = true</script>";
    const bytes = buildSyntheticPagedPdf({ pageCount: 110, citedText: markup });
    const parser = deterministicParser(110);
    const sinks = protectedSinkSpies();
    const harness = await createHarness({ bytes, parser, sinks, key: "malicious-input" });
    const workbench = await readWorkbench(harness.base);
    const valid = startBody(
      workbench,
      onlyCard(workbench).cardRef,
      operationKey("malicious-input"),
      "mace-musicks-monument-1676"
    );
    const forged = await postAtlas(harness.base, {
      ...valid,
      provider: "provider.fake-t11",
      rawSource: markup,
      allowCapability: { operation: "provider_model_processing", outcome: "allow" },
      fixtureInclusion: true,
    } as unknown as ReferencePageAtlasOperationRequest);
    expect(forged.response.status).toBe(400);
    expect(forged.json).toMatchObject({
      ok: false,
      error: { code: "invalid_request", status: 400 },
    });
    expect(parser.inspect).not.toHaveBeenCalled();
    expect(parser.renderPage).not.toHaveBeenCalled();
    for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();
    expect(JSON.stringify(forged.json)).not.toContain(markup);

    const validResult = await postAtlas(harness.base, valid);
    expect(validResult.response.status).toBe(200);
    const projection = requireOk(validResult.json);
    expect(JSON.stringify(projection)).not.toContain(markup);
    expect(projection.citedSegmentLineage.versions.flatMap(({ anchors }) => anchors)).toEqual(
      expect.arrayContaining([expect.objectContaining({ contentState: "withheld_local_only" })])
    );
    for (const sink of Object.values(sinks)) expect(sink).not.toHaveBeenCalled();
    assertNoSourceLeak(projection, harness.upload, bytes, markup);
  });
});

type HarnessOptions = Readonly<{
  bytes: Buffer;
  parser: ReferencePageAtlasParser;
  key: string;
  sinks?: ReferenceSourceProtectedOperationSinks;
  sourceProfileBytes?: Buffer;
}>;

async function createHarness(options: HarnessOptions) {
  const root = mkdtempSync(path.join(tmpdir(), `vellum-t11-${options.key}-`));
  roots.push(root);
  const paths = {
    owner: path.join(root, "owner"),
    migrationPrivate: path.join(root, "migration-private"),
    publication: path.join(root, "knowledge-publication"),
    staging: path.join(root, "reference-source-staging"),
    controlled: path.join(root, "controlled-artifacts"),
  };
  let stagingId = 0;
  const stagingStore = new ReferenceSourceStagingStore({
    rootDirectory: paths.staging,
    now: () => new Date(NOW),
  });
  const runtime = {
    publication: new KnowledgePublicationStore({
      rootDirectory: paths.publication,
      now: () => new Date(NOW),
    }),
    staging: new ReferenceSourceStagingService({
      store: stagingStore,
      now: () => new Date(NOW),
      createId: () => `t11-${options.key}-${++stagingId}`,
    }),
    controlled: new ReferenceSourceControlledArtifactStore({
      rootDirectory: paths.controlled,
      now: () => new Date(NOW),
    }),
  };
  const server = await listen(
    createApp({
      ownerReferenceMigrationOwnerRootDirectory: paths.owner,
      ownerReferenceMigrationPrivateRootDirectory: paths.migrationPrivate,
      ownerReferenceWorkbenchOpaqueKey: Buffer.alloc(32, 0x11),
      knowledgePublicationStore: runtime.publication,
      referenceSourceStagingService: runtime.staging,
      referenceSourceControlledArtifactStore: runtime.controlled,
      referencePageAtlasParser: options.parser,
      referencePageAtlasSourceProfileResolver: syntheticMaceProfileResolver(
        options.sourceProfileBytes ?? options.bytes
      ),
      referenceSourceProtectedOperationSinks: options.sinks,
    })
  );
  servers.push(server);
  const base = address(server);
  const uploadResult = await rawUpload(base, options.bytes, `t11-${options.key}-upload`);
  expect(uploadResult.response.status).toBe(200);
  const upload = requireOk(uploadResult.json);
  bindAsOwnerReference(runtime.staging, upload.digitalAsset, upload.acquisition, options.key);
  return { root, paths, runtime, server, base, upload };
}

type UploadResult = Readonly<{
  publicationState: "staging_only";
  replayed: boolean;
  digitalAsset: ReferenceDigitalAsset;
  acquisition: ReferenceAssetAcquisition;
  head: { snapshotId: string; digest: string; revision: number };
}>;

function bindAsOwnerReference(
  staging: ReferenceSourceStagingService,
  asset: ReferenceDigitalAsset,
  acquisition: ReferenceAssetAcquisition,
  key: string
): void {
  const suffix = createHash("sha256").update(key).digest("hex").slice(0, 24);
  const decision = withReferenceRecordDigest({
    recordKind: "access_decision" as const,
    id: `access.t11-owner-reference-binding.${suffix}`,
    version: 1,
    outcome: "allow" as const,
    operation: "owner_private_study" as const,
    sourceRefs: [ref(acquisition)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" as const },
    purpose: "Bind this exact synthetic upload to the local Owner Reference Library",
    assetRole: "owner_reference" as const,
    policyRef: externalRef("policy.t11-owner-reference-binding"),
    rightsAssertionRefs: [],
    authorityRefs: [externalRef("owner.t11-explicit-local-binding")],
    rationale: "The Owner explicitly binds only this acquisition for local fixture testing.",
    decidedAt: NOW,
  }) as ReferenceAccessDecision;
  const binding = withReferenceRecordDigest({
    recordKind: "owner_reference_binding" as const,
    id: `binding.t11-owner-reference.${suffix}`,
    digitalAssetRef: ref(asset),
    acquisitionRefs: [ref(acquisition)],
    accessDecisionRefs: [ref(decision)],
    retentionPolicyRef: externalRef("retention.t11-owner-reference"),
    ownerLibraryRef: externalRef("owner-library.t11-local"),
    createdAt: NOW,
  }) as OwnerReferenceBinding;
  const head = staging.readCurrent().head;
  if (!head) throw new Error("Expected a staging head before role binding");
  staging.applyTransaction({
    schemaVersion: 1,
    id: `transaction.t11-owner-reference-binding.${suffix}`,
    expectedHeadRef: { id: head.snapshotId, digest: head.digest },
    operations: ([decision, binding] satisfies ReferenceSourceStagingInputRecord[]).map(
      (record) => ({ type: "append_record" as const, record })
    ),
    submittedAt: NOW,
  });
}

function deterministicParser(pageCount: number) {
  const inspection: ReferencePageAtlasInspection = {
    schemaVersion: 1,
    parserId: "poppler.pdfinfo",
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      scanOrdinal: index + 1,
      widthPoints: 409,
      heightPoints: 674,
      rotationDegrees: 0 as const,
    })),
  };
  const inspect = vi.fn(async (_input: Readonly<{ bytes: Uint8Array }>) => inspection);
  const describeRuntime = vi.fn(async () => syntheticRuntimeIdentity());
  const renderPage = vi.fn(
    async (input: Readonly<{ bytes: Uint8Array; scanOrdinal: number }>) =>
      ({
        schemaVersion: 1,
        rendererId: "poppler.pdftoppm",
        scanOrdinal: input.scanOrdinal,
        mediaType: "image/png",
        widthPixels: 818,
        heightPixels: 1_348,
        bytes: renderedPng(input.scanOrdinal),
      }) satisfies ReferencePageAtlasRenderedPage
  );
  return { describeRuntime, inspect, renderPage } satisfies ReferencePageAtlasParser;
}

function syntheticMaceProfileResolver(bytes: Buffer) {
  const profile = defineMacePageAtlasSourceProfile({
    id: "source-profile.self-authored-t11-mace.v1",
    registryRef: externalRef("registry.self-authored-t11-mace.v1"),
    evidenceRef: externalRef("evidence.self-authored-t11-mace.v1"),
    exactAsset: {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.byteLength,
      mediaType: "application/pdf",
      pageCount: 110,
    },
    identity: {
      preferredTitle: "Self-authored T11 Mace source",
      workDate: "2026",
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
        text: { x: 0.1, y: 0.6, width: 0.6, height: 0.1 },
        notation: { x: 0.4, y: 0.4, width: 0.3, height: 0.1 },
      },
    },
  });
  return new ExactAssetReferencePageAtlasSourceProfileResolver([profile]);
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

function renderedPng(scanOrdinal: number): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(`T11-SYNTHETIC-PAGE-${scanOrdinal}`, "ascii"),
  ]);
}

function startBody(
  workbench: OwnerReferenceWorkbenchSnapshot,
  cardRef: ReferenceRecordRef,
  key: string,
  profile: ReferencePageAtlasProfile
) {
  return {
    schemaVersion: 1 as const,
    action: "start" as const,
    workbenchSnapshotRef: workbench.snapshotRef,
    workbenchCardRef: cardRef,
    purpose: LOCAL_EXTRACTION_PURPOSE,
    authorization: "owner_attested_local_extraction" as const,
    operationKey: key,
    profile,
    profileSelection: "owner_selected" as const,
  };
}

function operationKey(seed: string): string {
  const token = createHash("sha256").update(seed).digest("base64url").slice(0, 21);
  return `owner-page-atlas.v1.${token}A`;
}

function onlyCard(workbench: OwnerReferenceWorkbenchSnapshot) {
  expect(workbench.references).toHaveLength(1);
  return workbench.references[0]!;
}

function currentRecords(staging: ReferenceSourceStagingService): ReferenceSourceStagingRecord[] {
  return [...(staging.readCurrent().snapshot?.records ?? [])];
}

function assertMaceCanonicalGraph(
  records: readonly ReferenceSourceStagingRecord[],
  upload: UploadResult,
  purpose: string
): void {
  expect(
    records.find(
      (record): record is ReferenceAccessDecision =>
        record.recordKind === "access_decision" && record.operation === "local_extraction"
    )
  ).toMatchObject({
    outcome: "allow",
    sourceRefs: [ref(upload.acquisition)],
    derivativeRefs: [],
    destination: { kind: "local_runtime" },
    purpose,
  });
  expect(records.filter(({ recordKind }) => recordKind === "page_atlas_version")).toHaveLength(1);
  expect(records.filter(({ recordKind }) => recordKind === "source_segment_version")).toHaveLength(
    1
  );
  expect(
    records.filter(({ recordKind }) => recordKind === "cited_extraction_version")
  ).toHaveLength(1);
  expect(records.filter(({ recordKind }) => recordKind === "extraction_proposal")).toHaveLength(2);
  expect(
    records.filter(({ recordKind }) => recordKind === "asset_identity_resolution")
  ).toHaveLength(1);
  const identityAssertion = records.find(({ recordKind }) => recordKind === "identity_assertion");
  expect(identityAssertion).toMatchObject({
    assertedValue: { kind: "text", value: "Self-authored T11 Mace source" },
    claimant: { kind: "system" },
    assertionState: "candidate",
  });
  expect(
    identityAssertion?.recordKind === "identity_assertion" && identityAssertion.evidenceRefs
  ).toEqual([externalRef("evidence.self-authored-t11-mace.v1")]);
  const extraction = records.find(({ recordKind }) => recordKind === "cited_extraction_version");
  expect(extraction).toMatchObject({
    originalTranscription: "a /a //a ///a 4 5",
    normalizedTranscription: "a /a //a ///a 4 5",
    reviewState: "proposed",
    unresolvedAlternatives: expect.arrayContaining([expect.stringMatching(/thirteenth-course/i)]),
  });
  expect(
    records.filter(({ recordKind }) =>
      ["knowledge_pack_release", "release_attestation", "activation_decision"].includes(recordKind)
    )
  ).toEqual([]);
}

function assertMovedScanRequiresReextraction(
  before: readonly ReferenceSourceStagingRecord[],
  after: readonly ReferenceSourceStagingRecord[]
): void {
  const priorSegments = before.filter(({ recordKind }) => recordKind === "source_segment_version");
  const successorSegments = after.filter(
    ({ recordKind }) => recordKind === "source_segment_version"
  );
  expect(priorSegments).toHaveLength(1);
  expect(successorSegments).toHaveLength(2);
  expect(successorSegments).toContainEqual(priorSegments[0]);
  expect(after.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(1);
  const citationSuccessor = after.find(({ recordKind }) => recordKind === "citation_successor");
  expect(citationSuccessor).toMatchObject({
    recordKind: "citation_successor",
    priorSegmentRef: ref(priorSegments[0]!),
    successorSegmentRef: ref(successorSegments[1]!),
    extractionTransition: "reextraction_required",
    priorCitedExtractionRefs: [
      ref(before.find(({ recordKind }) => recordKind === "cited_extraction_version")!),
    ],
    successorCitedExtractionRefs: [],
  });
  expect(after.filter(({ recordKind }) => recordKind === "cited_extraction_version")).toHaveLength(
    1
  );
  expect(after.filter(({ recordKind }) => recordKind === "extraction_proposal")).toHaveLength(2);
  const atlases = after.filter(({ recordKind }) => recordKind === "page_atlas_version");
  const correctedPriorCanvas = atlases[1]!.canvases.find(({ scanOrder }) => scanOrder === 105)!;
  const correctedTargetCanvas = atlases[1]!.canvases.find(({ scanOrder }) => scanOrder === 104)!;
  expect(correctedPriorCanvas.locators.filter(({ kind }) => kind === "printed_page")).toEqual([]);
  expect(
    correctedTargetCanvas.locators
      .filter(({ kind }) => kind === "printed_page")
      .map(({ label }) => label)
  ).toEqual(["frontispiece"]);
  const correctionAttempt = after.find(
    (record) => record.recordKind === "page_atlas_attempt" && record.attemptKind === "correction"
  );
  expect(correctionAttempt).toMatchObject({
    status: "completed",
    basisAtlasRef: ref(atlases[0]!),
    outputAtlasRef: ref(atlases[1]!),
    componentRef: atlases[1]!.componentRef,
    configurationDigest: atlases[1]!.configurationDigest,
    resourcePolicyRef: atlases[1]!.resourcePolicyRef,
  });
}

function assertImmutableCorrectionGraph(
  before: readonly ReferenceSourceStagingRecord[],
  after: readonly ReferenceSourceStagingRecord[]
): void {
  const priorSegments = before.filter(({ recordKind }) => recordKind === "source_segment_version");
  const successorSegments = after.filter(
    ({ recordKind }) => recordKind === "source_segment_version"
  );
  expect(priorSegments).toHaveLength(1);
  expect(successorSegments).toHaveLength(3);
  expect(successorSegments).toContainEqual(priorSegments[0]);
  expect(after.filter(({ recordKind }) => recordKind === "page_atlas_correction")).toHaveLength(2);
  const citationSuccessors = after.filter(({ recordKind }) => recordKind === "citation_successor");
  expect(citationSuccessors).toHaveLength(2);
  expect(citationSuccessors[0]).toMatchObject({
    priorSegmentRef: ref(successorSegments[0]!),
    successorSegmentRef: ref(successorSegments[1]!),
    extractionTransition: "reextraction_required",
    successorCitedExtractionRefs: [],
  });
  const extractions = after.filter(({ recordKind }) => recordKind === "cited_extraction_version");
  expect(extractions).toHaveLength(2);
  expect(citationSuccessors[1]).toMatchObject({
    priorSegmentRef: ref(successorSegments[1]!),
    successorSegmentRef: ref(successorSegments[2]!),
    extractionTransition: "reextracted",
    priorCitedExtractionRefs: [],
    successorCitedExtractionRefs: [ref(extractions[1]!)],
  });
  expect(extractions[1]).toMatchObject({
    version: 2,
    parentVersionRef: {
      ...ref(extractions[0]!),
      version: 1,
    },
    sourceSegmentRefs: [ref(successorSegments[2]!)],
  });
  expect(after.filter(({ recordKind }) => recordKind === "extraction_proposal")).toHaveLength(4);
  const atlases = after.filter(({ recordKind }) => recordKind === "page_atlas_version");
  const finalPrintedLocators = atlases[2]!.canvases.flatMap(({ scanOrder, locators }) =>
    locators
      .filter(({ kind }) => kind === "printed_page")
      .map(({ label }) => ({ scanOrder, label }))
  );
  expect(finalPrintedLocators).toContainEqual({ scanOrder: 105, label: "76" });
  expect(finalPrintedLocators).not.toContainEqual({ scanOrder: 106, label: "76" });
  expect(finalPrintedLocators.some(({ label }) => label === "frontispiece")).toBe(false);
  const correctionAttempts = after.filter(
    (record) => record.recordKind === "page_atlas_attempt" && record.attemptKind === "correction"
  );
  expect(correctionAttempts).toHaveLength(2);
  expect(correctionAttempts[1]).toMatchObject({
    status: "completed",
    basisAtlasRef: ref(atlases[1]!),
    outputAtlasRef: ref(atlases[2]!),
    componentRef: atlases[2]!.componentRef,
    configurationDigest: atlases[2]!.configurationDigest,
    resourcePolicyRef: atlases[2]!.resourcePolicyRef,
  });
}

function assertSeparateUncertaintyDimensions(projection: ReferencePageAtlasProjection): void {
  expect(Object.keys(projection.confidence).sort()).toEqual(
    ["sourceIdentity", "pageMapping", "extraction", "interpretation", "applicability"].sort()
  );
  expect(projection.confidence.interpretation).toEqual({
    state: "unknown",
    reason: "not_assessed",
  });
  expect(projection.confidence.applicability).toEqual({
    state: "unknown",
    reason: "not_assessed",
  });
}

function assertNoSourceLeak(
  value: unknown,
  upload: UploadResult,
  bytes: Uint8Array,
  ...canaries: string[]
): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    upload.digitalAsset.id,
    upload.digitalAsset.digest,
    upload.digitalAsset.sha256,
    upload.acquisition.id,
    upload.acquisition.digest,
    createHash("sha256").update(bytes).digest("hex"),
    Buffer.from(bytes).toString("base64"),
    ...canaries,
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

function protectedSinkSpies() {
  return {
    localReview: vi.fn(),
    compilerInput: vi.fn(),
    provider: vi.fn(),
    knowledgeAuthority: vi.fn(),
    fixtureRepository: vi.fn(),
    sourceRepository: vi.fn(),
    export: vi.fn(),
    redistribution: vi.fn(),
    report: vi.fn(),
    log: vi.fn(),
  } satisfies ReferenceSourceProtectedOperationSinks;
}

async function rawUpload(base: string, bytes: Uint8Array, acquisitionKey: string) {
  const response = await fetch(`${base}/api/owner/reference-source-staging/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Reference-Acquisition-Key": acquisitionKey,
    },
    body: bytes,
  });
  return { response, json: (await response.json()) as ApiResponse<UploadResult> };
}

async function readWorkbench(base: string): Promise<OwnerReferenceWorkbenchSnapshot> {
  const response = await jsonRequest<OwnerReferenceWorkbenchSnapshot>(
    `${base}/api/owner/reference-source-workbench`
  );
  expect(response.response.status).toBe(200);
  return requireOk(response.json);
}

async function postAtlas(base: string, body: ReferencePageAtlasOperationRequest) {
  return jsonRequest<ReferencePageAtlasProjection>(`${base}${PAGE_ATLAS_PATH}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function preview(
  base: string,
  projection: ReferencePageAtlasProjection,
  segmentRef: ReferenceRecordRef
) {
  const response = await fetch(`${base}${PREVIEW_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      action: "preview",
      workbenchSnapshotRef: projection.workbenchSnapshotRef,
      workbenchCardRef: projection.workbenchCardRef,
      operationRef: projection.operationRef,
      projectionRef: projection.projectionRef,
      segmentRef,
    }),
  });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

function assertRegenerationUnavailable(response: Response, bytes: Buffer): void {
  expect(response.status).toBe(422);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(bytes.toString("utf8")).toContain('"code":"unprocessable_content"');
  expect(bytes.toString("utf8")).not.toContain("T11-SYNTHETIC-PAGE");
}

async function oversizedHeaderUpload(base: string): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const target = new URL(`${base}/api/owner/reference-source-staging/assets`);
    const request = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "content-type": "application/pdf",
          "content-length": String(32 * 1024 * 1024 + 1),
          "x-reference-acquisition-key": "t11-oversized-declared-upload",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode ?? 0,
              json: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function requireOk<T>(response: ApiResponse<T>): T {
  if (!response.ok) throw new Error(`Expected successful API response, got ${response.error.code}`);
  return response.data;
}

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function address(server: Server): string {
  const value = server.address();
  if (!value || typeof value === "string") throw new Error("Expected TCP server address");
  return `http://127.0.0.1:${value.port}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

async function jsonRequest<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  return { response, json: (await response.json()) as ApiResponse<T> };
}
