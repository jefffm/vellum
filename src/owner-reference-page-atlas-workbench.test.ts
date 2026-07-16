// @vitest-environment jsdom

import { Value } from "@sinclair/typebox/value";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReferencePageAtlasPreviewRequestSchema,
  ReferencePageAtlasProjectionSchema,
  ReferencePageAtlasStartRequestSchema,
  type ReferencePageAtlasOpaqueHmacRef,
  type ReferencePageAtlasProfile,
  type ReferencePageAtlasProjection,
} from "./lib/reference-page-atlas-contract.js";
import {
  openOwnerReferencePageAtlasWorkbench,
  type OwnerReferencePageAtlasWorkbenchCallbacks,
} from "./owner-reference-page-atlas-workbench.js";

const SNAPSHOT_REF = ref("workbench-snapshot.fixture", "a");
const STARTED_SNAPSHOT_REF = ref("workbench-snapshot.started", "a");
const CORRECTED_SNAPSHOT_REF = ref("workbench-snapshot.corrected", "a");
const CARD_REF = ref("card.fixture", "b");
const PURPOSE_CANARY = "PRIVATE-PURPOSE-CANARY: build the exact local Page Atlas";

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("private Page Atlas client contract", () => {
  it("accepts only opaque, closed operation requests and an exact Mace tuple", () => {
    const start = {
      schemaVersion: 1,
      action: "start",
      workbenchSnapshotRef: SNAPSHOT_REF,
      workbenchCardRef: CARD_REF,
      purpose: "Build an exact local citation",
      authorization: "owner_attested_local_extraction",
      operationKey: "owner-page-atlas.v1.AAAAAAAAAAAAAAAAAAAAAA",
      profile: "mace-musicks-monument-1676",
      profileSelection: "owner_selected",
    };
    expect(Value.Check(ReferencePageAtlasStartRequestSchema, start)).toBe(true);
    expect(
      Value.Check(ReferencePageAtlasStartRequestSchema, { ...start, sourcePath: "/private" })
    ).toBe(false);
    expect(
      Value.Check(ReferencePageAtlasStartRequestSchema, {
        ...start,
        workbenchCardRef: { id: "digital-asset.raw", digest: "b".repeat(64) },
      })
    ).toBe(false);

    const projection = maceProjection();
    expect(Value.Check(ReferencePageAtlasProjectionSchema, projection)).toBe(true);
    const leak = structuredClone(projection) as ReferencePageAtlasProjection & {
      parserStderr: string;
    };
    leak.parserStderr = "PRIVATE-PARSER-STDERR-CANARY";
    expect(Value.Check(ReferencePageAtlasProjectionSchema, leak)).toBe(false);
    const wrongSign = structuredClone(projection);
    if (wrongSign.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
      throw new Error("Expected Mace fixture");
    }
    (wrongSign.stagedKnowledge.courseMappings[4] as { course: 11; sign: string }).sign = "/4";
    expect(Value.Check(ReferencePageAtlasProjectionSchema, wrongSign)).toBe(false);

    const preview = {
      schemaVersion: 1,
      action: "preview",
      workbenchSnapshotRef: SNAPSHOT_REF,
      workbenchCardRef: CARD_REF,
      operationRef: projection.operationRef,
      projectionRef: projection.projectionRef,
      segmentRef: projection.citedSegmentLineage.currentSegmentRef,
    };
    expect(Value.Check(ReferencePageAtlasPreviewRequestSchema, preview)).toBe(true);
    expect(
      Value.Check(ReferencePageAtlasPreviewRequestSchema, {
        ...preview,
        privateCropPath: "/private/crop.png",
      })
    ).toBe(false);
  });
});

describe("private Page Atlas Workbench", () => {
  it("requires explicit profile selection and attestation, previews page 75, and preserves citation lineage", async () => {
    const first = maceProjection();
    const corrected = correctedMaceProjection();
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:page-atlas-first")
      .mockReturnValueOnce("blob:page-atlas-successor");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const callbacks: OwnerReferencePageAtlasWorkbenchCallbacks = {
      start: vi.fn(async () => first),
      read: vi.fn(async () => first),
      preview: vi.fn(async () => ({
        blob: new window.Blob(["PNG-PRIVATE-CANARY"], { type: "image/png" }),
        mediaType: "image/png" as const,
      })),
      resume: vi.fn(async () => first),
      cancel: vi.fn(async () => first),
      correctMapping: vi.fn(async () => corrected),
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialPurpose: PURPOSE_CANARY,
      },
      callbacks
    );
    const profile = handle.dialog.querySelector<HTMLSelectElement>('select[name="profile"]')!;
    const start = handle.dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const attestation = handle.dialog.querySelector<HTMLInputElement>(
      'input[aria-label="Attest to local extraction only"]'
    )!;

    expect(profile.value).toBe("generic_paged_source");
    expect(start.disabled).toBe(true);
    expect(handle.dialog.textContent).toContain("never infers Mace");
    profile.value = "mace-musicks-monument-1676";
    profile.dispatchEvent(new Event("change", { bubbles: true }));
    attestation.checked = true;
    attestation.dispatchEvent(new Event("change", { bubbles: true }));
    start.click();

    await vi.waitFor(() => expect(callbacks.start).toHaveBeenCalledOnce());
    expect(callbacks.start).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "start",
        workbenchSnapshotRef: SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        authorization: "owner_attested_local_extraction",
        profile: "mace-musicks-monument-1676",
        profileSelection: "owner_selected",
        purpose: PURPOSE_CANARY,
        operationKey: expect.stringMatching(/^owner-page-atlas\.v1\.[A-Za-z0-9_-]{21}[AQgw]$/),
      }),
      expect.any(AbortSignal)
    );
    await vi.waitFor(() => expect(callbacks.preview).toHaveBeenCalledOnce());
    expect(callbacks.preview).toHaveBeenCalledWith({
      schemaVersion: 1,
      action: "preview",
      workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
      workbenchCardRef: CARD_REF,
      operationRef: first.operationRef,
      projectionRef: first.projectionRef,
      segmentRef: first.citedSegmentLineage.currentSegmentRef,
    });
    await vi.waitFor(() =>
      expect(
        handle.dialog.querySelector<HTMLImageElement>(".owner-reference-page-atlas-private-preview")
          ?.src
      ).toContain("blob:page-atlas-first")
    );
    const storedRetryState = allStorageValues(window.localStorage);
    expect(storedRetryState).not.toContain(PURPOSE_CANARY);
    expect(storedRetryState).not.toContain("PNG-PRIVATE-CANARY");
    expect(JSON.parse(window.localStorage.getItem(startedStorageKey(CARD_REF))!)).toEqual({
      schemaVersion: 1,
      state: "started",
      cardRef: CARD_REF,
      operationRef: first.operationRef,
      profile: "mace-musicks-monument-1676",
    });
    expect(
      window.localStorage.getItem(pendingStorageKey(CARD_REF, "mace-musicks-monument-1676"))
    ).toBeNull();

    expect(handle.dialog.textContent).toContain("Scan page 105 · printed page 75");
    expect(
      handle.dialog.querySelector<HTMLButtonElement>(
        'button[aria-label="Refresh Atlas projection"]'
      )?.disabled
    ).toBe(false);
    expect(handle.dialog.textContent).toContain("Exact staged course-sign sequence");
    expect(handle.dialog.textContent).toContain("Course 7");
    expect(handle.dialog.textContent).toContain("Course 12");
    expect(handle.dialog.textContent).toContain("No sign is inferred");
    expect(handle.dialog.querySelectorAll(".owner-reference-page-atlas-anchor")).toHaveLength(3);
    expect(handle.dialog.textContent).not.toContain("PNG-PRIVATE-CANARY");

    handle.dialog.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
    expect(
      handle.dialog.querySelector<HTMLButtonElement>('button[aria-label="Reset zoom"]')!.textContent
    ).toBe("125%");

    const correction = handle.dialog.querySelector<HTMLFormElement>(
      ".owner-reference-page-atlas-correction"
    )!;
    const scanPage = correction.querySelector<HTMLInputElement>('input[type="number"]')!;
    scanPage.value = "106";
    correction.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(callbacks.correctMapping).toHaveBeenCalledOnce());
    expect(callbacks.correctMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "correct_mapping",
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        expectedProjectionRef: first.projectionRef,
        correction: expect.objectContaining({ scanPageNumber: 106, printedLocator: "75" }),
      }),
      expect.any(AbortSignal)
    );
    await vi.waitFor(() => expect(callbacks.preview).toHaveBeenCalledTimes(2));
    expect(callbacks.preview).toHaveBeenLastCalledWith(
      expect.objectContaining({ workbenchSnapshotRef: CORRECTED_SNAPSHOT_REF })
    );
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:page-atlas-first"));
    expect(handle.dialog.querySelectorAll("[data-citation-version]")).toHaveLength(2);
    expect(handle.dialog.textContent).toContain("immutable predecessor");
    expect(handle.dialog.textContent).toContain("current successor");

    handle.close();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:page-atlas-successor");
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("keeps a redacted placeholder when the strict private preview fails", async () => {
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const projection = maceProjection();
    const callbacks: OwnerReferencePageAtlasWorkbenchCallbacks = {
      start: vi.fn(async () => projection),
      read: vi.fn(async () => projection),
      preview: vi.fn(
        async () =>
          ({
            blob: new window.Blob(["NOT-PNG"], { type: "text/plain" }),
            mediaType: "image/png",
            privatePath: "/PRIVATE-PREVIEW-PATH-CANARY",
          }) as never
      ),
      resume: vi.fn(async () => projection),
      cancel: vi.fn(async () => projection),
      correctMapping: vi.fn(async () => projection),
    };
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialProjection: projection,
      },
      callbacks
    );

    await vi.waitFor(() =>
      expect(handle.dialog.textContent).toContain("private cited-segment preview is unavailable")
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(handle.dialog.textContent).not.toContain("PRIVATE-PREVIEW-PATH-CANARY");
    handle.close();
  });

  it("restores a started opaque operation on reload without persisting its purpose", async () => {
    installObjectUrlMocks();
    const projection = maceProjection();
    const firstCallbacks = callbacksFor(projection, {
      start: vi.fn(async () => projection),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const firstHandle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialPurpose: PURPOSE_CANARY,
      },
      firstCallbacks
    );
    selectMaceAndStart(firstHandle.dialog);
    await vi.waitFor(() => expect(firstCallbacks.start).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(window.localStorage.getItem(startedStorageKey(CARD_REF))).not.toBeNull()
    );
    firstHandle.close();

    const read = vi.fn(async () => projection);
    const start = vi.fn(async () => projection);
    const resumedCallbacks = callbacksFor(projection, { read, start });
    const resumed = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialPurpose: "A DIFFERENT PURPOSE MUST NOT BE READ FROM STORAGE",
      },
      resumedCallbacks
    );

    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect(read).toHaveBeenCalledWith({
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
      workbenchCardRef: CARD_REF,
      operationRef: projection.operationRef,
    });
    await vi.waitFor(() =>
      expect(resumed.dialog.textContent).toContain("Scan page 105 · printed page 75")
    );
    expect(start).not.toHaveBeenCalled();
    expect(allStorageValues(window.localStorage)).not.toContain(PURPOSE_CANARY);
    expect(allStorageValues(window.localStorage)).not.toContain("A DIFFERENT PURPOSE");
    resumed.close();
  });

  it("reuses a pending card-and-profile key after an uncertain start", async () => {
    installObjectUrlMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const projection = maceProjection();
    const failedStart = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["start"]>(async () => {
      throw new Error("PRIVATE-DIAGNOSTIC-CANARY");
    });
    const first = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialPurpose: PURPOSE_CANARY,
      },
      callbacksFor(projection, { start: failedStart })
    );
    selectMaceAndStart(first.dialog);
    await vi.waitFor(() => expect(failedStart).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(first.dialog.textContent).toContain("outcome could not be confirmed")
    );
    const firstOperationKey = failedStart.mock.calls[0]![0].operationKey;
    const pendingRaw = window.localStorage.getItem(
      pendingStorageKey(CARD_REF, "mace-musicks-monument-1676")
    );
    expect(pendingRaw).not.toBeNull();
    expect(pendingRaw).not.toContain(PURPOSE_CANARY);
    expect(pendingRaw).not.toContain("PRIVATE-DIAGNOSTIC-CANARY");
    first.close();

    const succeedingStart = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["start"]>(
      async () => projection
    );
    const second = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialPurpose: PURPOSE_CANARY,
      },
      callbacksFor(projection, { start: succeedingStart })
    );
    const profile = second.dialog.querySelector<HTMLSelectElement>('select[name="profile"]')!;
    profile.value = "mace-musicks-monument-1676";
    profile.dispatchEvent(new Event("change", { bubbles: true }));
    expect(second.dialog.textContent).toContain("protected opaque retry identity exists");
    attestAndStart(second.dialog);

    await vi.waitFor(() => expect(succeedingStart).toHaveBeenCalledOnce());
    expect(succeedingStart.mock.calls[0]![0].operationKey).toBe(firstOperationKey);
    await vi.waitFor(() =>
      expect(window.localStorage.getItem(startedStorageKey(CARD_REF))).not.toBeNull()
    );
    expect(
      window.localStorage.getItem(pendingStorageKey(CARD_REF, "mace-musicks-monument-1676"))
    ).toBeNull();
    second.close();
  });

  it("aborts an uncertain initial start when the Workbench closes", async () => {
    installObjectUrlMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let observedSignal: AbortSignal | undefined;
    const start = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["start"]>(
      async (_request, signal) => {
        observedSignal = signal;
        await new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });
      }
    );
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      { workbenchSnapshotRef: SNAPSHOT_REF, workbenchCardRef: CARD_REF },
      callbacksFor(genericProjection(), { start })
    );

    attestAndStart(handle.dialog);
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(observedSignal?.aborted).toBe(false);

    handle.close();

    expect(observedSignal?.aborted).toBe(true);
    await vi.waitFor(() => expect(handle.dialog.isConnected).toBe(false));
  });

  it("aborts in-flight resume and mapping-correction requests when the Workbench closes", async () => {
    installObjectUrlMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const base = maceProjection();
    const paused: ReferencePageAtlasProjection = Value.Decode(ReferencePageAtlasProjectionSchema, {
      ...base,
      atlas: {
        ...base.atlas,
        state: "paused",
        coverage: {
          ...base.atlas.coverage,
          completeness: "partial",
        },
      },
    });
    let resumeSignal: AbortSignal | undefined;
    const resume = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["resume"]>(
      async (_request, signal) => {
        resumeSignal = signal;
        await rejectWhenAborted(signal);
      }
    );
    const resumeHandle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialProjection: paused,
      },
      callbacksFor(paused, { resume })
    );
    resumeHandle.dialog
      .querySelector<HTMLButtonElement>('button[aria-label="Resume Atlas generation"]')!
      .click();
    await vi.waitFor(() => expect(resume).toHaveBeenCalledOnce());
    expect(resumeSignal?.aborted).toBe(false);
    resumeHandle.close();
    expect(resumeSignal?.aborted).toBe(true);

    let correctionSignal: AbortSignal | undefined;
    const correctMapping = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["correctMapping"]>(
      async (_request, signal) => {
        correctionSignal = signal;
        await rejectWhenAborted(signal);
      }
    );
    const correctionHandle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialProjection: base,
      },
      callbacksFor(base, { correctMapping })
    );
    correctionHandle.dialog
      .querySelector<HTMLFormElement>(".owner-reference-page-atlas-correction")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(correctMapping).toHaveBeenCalledOnce());
    expect(correctionSignal?.aborted).toBe(false);
    correctionHandle.close();
    expect(correctionSignal?.aborted).toBe(true);
  });

  it("fails closed on oversized retry state and resets only the opened card namespace", async () => {
    const otherCard = ref("card.other", "c");
    const otherPending = JSON.stringify({
      schemaVersion: 1,
      state: "pending",
      cardRef: otherCard,
      operationKey: "owner-page-atlas.v1.AAAAAAAAAAAAAAAAAAAAAA",
    });
    window.localStorage.setItem(pendingStorageKey(otherCard, "generic_paged_source"), otherPending);
    window.localStorage.setItem(startedStorageKey(CARD_REF), "x".repeat(1_025));
    const read = vi.fn(async () => maceProjection());
    const preview = vi.fn(async () => ({
      blob: new window.Blob(["PNG"], { type: "image/png" }),
      mediaType: "image/png" as const,
    }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      { workbenchSnapshotRef: SNAPSHOT_REF, workbenchCardRef: CARD_REF },
      callbacksFor(maceProjection(), { read, preview })
    );

    expect(handle.dialog.textContent).toContain("invalid, unknown, or oversized");
    expect(handle.dialog.querySelector('select[name="profile"]')).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    handle.dialog
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Reset browser-local Atlas retry state"]'
      )!
      .click();

    await vi.waitFor(() => expect(handle.dialog.textContent).toContain("Start a local Page Atlas"));
    expect(window.localStorage.getItem(startedStorageKey(CARD_REF))).toBeNull();
    expect(window.localStorage.getItem(pendingStorageKey(otherCard, "generic_paged_source"))).toBe(
      otherPending
    );
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("only the browser-local opaque"));
    handle.close();
  });

  it("uses projected landscape/rotation geometry and keeps anchor labels outside the cited regions", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const landscape = maceProjection();
    landscape.target.canvas = {
      coordinateSystem: "normalized-top-left.v1",
      widthPixels: 1_600,
      heightPixels: 900,
      rotationDegrees: 90,
    };
    landscape.target.pageState.rasterization = "observed_not_persisted";
    landscape.citedSegmentLineage.versions[0]!.previewState = "regeneration_unavailable";
    const preview = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["preview"]>();
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      { workbenchSnapshotRef: SNAPSHOT_REF, workbenchCardRef: CARD_REF },
      callbacksFor(landscape, { preview })
    );
    selectMaceAndStart(handle.dialog);

    await vi.waitFor(() => expect(handle.dialog.textContent).toContain("1600×900px"));
    const sheet = handle.dialog.querySelector<HTMLElement>(".owner-reference-page-atlas-sheet")!;
    expect(sheet.style.aspectRatio).toBe("1600 / 900");
    expect(sheet.dataset.rotationDegrees).toBe("90");
    expect(preview).not.toHaveBeenCalled();
    expect(handle.dialog.textContent).toContain("will not rerender current bytes");
    const markers = [
      ...handle.dialog.querySelectorAll<HTMLElement>(".owner-reference-page-atlas-anchor"),
    ];
    expect(markers).toHaveLength(3);
    for (const marker of markers) {
      expect(marker.tabIndex).toBe(0);
      expect(marker.title).toContain("anchor");
      expect(
        marker.querySelector(":scope > .owner-reference-page-atlas-anchor-label")
      ).not.toBeNull();
    }
    handle.close();
  });

  it("keeps Cancel available while a resume request is still running", async () => {
    installObjectUrlMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const base = maceProjection();
    const paused: ReferencePageAtlasProjection = Value.Decode(ReferencePageAtlasProjectionSchema, {
      ...base,
      atlas: {
        ...base.atlas,
        state: "paused",
        coverage: {
          ...base.atlas.coverage,
          enumeratedPages: 3,
          totalPages: 310,
          remainingPages: 307,
          percentComplete: 0.97,
          completeness: "partial",
        },
        checkpointRef: ref("page-atlas-checkpoint.paused", "a"),
      },
    });
    const cancelled: ReferencePageAtlasProjection = Value.Decode(
      ReferencePageAtlasProjectionSchema,
      {
        ...paused,
        projectionRef: ref("page-atlas-projection.cancelled", "b"),
        atlas: {
          ...paused.atlas,
          state: "cancelled",
          stop: { reason: "owner_cancelled", diagnostics: "redacted" },
        },
      }
    );
    let resolveResume!: (projection: ReferencePageAtlasProjection) => void;
    const resume = vi.fn(
      () =>
        new Promise<ReferencePageAtlasProjection>((resolve) => {
          resolveResume = resolve;
        })
    );
    const cancel = vi.fn(async () => cancelled);
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
        workbenchCardRef: CARD_REF,
        initialProjection: paused,
      },
      callbacksFor(paused, { resume, cancel })
    );

    const resumeButton = handle.dialog.querySelector<HTMLButtonElement>(
      'button[aria-label="Resume Atlas generation"]'
    )!;
    const cancelButton = handle.dialog.querySelector<HTMLButtonElement>(
      'button[aria-label="Cancel Atlas generation"]'
    )!;
    resumeButton.click();
    await vi.waitFor(() => expect(resume).toHaveBeenCalledOnce());
    expect(cancelButton.disabled).toBe(false);
    cancelButton.click();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(handle.dialog.textContent).toContain("owner cancelled"));
    resolveResume(cancelled);
    await vi.waitFor(() => expect(resumeButton.isConnected).toBe(false));
    handle.close();
  });

  it("keeps the generic paged-source profile usable without manufacturing seed knowledge", async () => {
    installObjectUrlMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const projection = genericProjection();
    const start = vi.fn<OwnerReferencePageAtlasWorkbenchCallbacks["start"]>(async () => projection);
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      { workbenchSnapshotRef: SNAPSHOT_REF, workbenchCardRef: CARD_REF },
      callbacksFor(projection, { start })
    );

    expect(handle.dialog.querySelector<HTMLSelectElement>('select[name="profile"]')!.value).toBe(
      "generic_paged_source"
    );
    attestAndStart(handle.dialog);
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(handle.dialog.textContent).toContain("Generic PDFs remain fully usable")
    );
    expect(start.mock.calls[0]![0].profile).toBe("generic_paged_source");
    expect(handle.dialog.textContent).not.toContain("Twelve-course diapason notation");
    handle.close();
  });

  it("explains that a moved profiled scan needs re-extraction instead of showing stale knowledge", () => {
    installObjectUrlMocks();
    const base = correctedMaceProjection();
    const moved = Value.Decode(ReferencePageAtlasProjectionSchema, {
      ...base,
      target: {
        ...base.target,
        pageState: {
          ...base.target.pageState,
          contentExtraction: "not_extracted",
        },
      },
      citedSegmentLineage: {
        ...base.citedSegmentLineage,
        versions: base.citedSegmentLineage.versions.map((version, index) =>
          index === base.citedSegmentLineage.versions.length - 1
            ? { ...version, anchors: version.anchors.filter(({ kind }) => kind === "image") }
            : version
        ),
      },
      stagedKnowledge: {
        kind: "none",
        reason: "reextraction_required",
      },
    });
    const handle = openOwnerReferencePageAtlasWorkbench(
      document,
      {
        workbenchSnapshotRef: moved.workbenchSnapshotRef,
        workbenchCardRef: CARD_REF,
        initialProjection: moved,
      },
      callbacksFor(moved)
    );

    expect(handle.dialog.textContent).toContain("corrected scan has an image citation only");
    expect(handle.dialog.textContent).toContain("did not copy the predecessor page’s regions");
    expect(handle.dialog.textContent).not.toContain("Exact staged course-sign sequence");
    handle.close();
  });
});

function callbacksFor(
  projection: ReferencePageAtlasProjection,
  overrides: Partial<OwnerReferencePageAtlasWorkbenchCallbacks> = {}
): OwnerReferencePageAtlasWorkbenchCallbacks {
  return {
    start: async () => projection,
    read: async () => projection,
    preview: async () => ({
      blob: new window.Blob(["PNG"], { type: "image/png" }),
      mediaType: "image/png",
    }),
    resume: async () => projection,
    cancel: async () => projection,
    correctMapping: async () => projection,
    ...overrides,
  };
}

function rejectWhenAborted(signal?: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
      once: true,
    });
  });
}

function selectMaceAndStart(dialog: HTMLDialogElement): void {
  const profile = dialog.querySelector<HTMLSelectElement>('select[name="profile"]')!;
  profile.value = "mace-musicks-monument-1676";
  profile.dispatchEvent(new Event("change", { bubbles: true }));
  attestAndStart(dialog);
}

function attestAndStart(dialog: HTMLDialogElement): void {
  const attestation = dialog.querySelector<HTMLInputElement>(
    'input[aria-label="Attest to local extraction only"]'
  )!;
  attestation.checked = true;
  attestation.dispatchEvent(new Event("change", { bubbles: true }));
  dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
}

function installObjectUrlMocks(): void {
  let sequence = 0;
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:page-atlas-${++sequence}`),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

function startedStorageKey(cardRef: ReferencePageAtlasOpaqueHmacRef): string {
  return `vellum.owner-reference-page-atlas.started.v1.${cardRef.id}`;
}

function pendingStorageKey(
  cardRef: ReferencePageAtlasOpaqueHmacRef,
  profile: ReferencePageAtlasProfile
): string {
  const profileSlot =
    profile === "generic_paged_source" ? "generic-paged-source" : "mace-musicks-monument-1676";
  return `vellum.owner-reference-page-atlas.pending.${profileSlot}.v1.${cardRef.id}`;
}

function allStorageValues(storage: Storage): string {
  const values: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) values.push(storage.getItem(key) ?? "");
  }
  return values.join("\n");
}

function genericProjection(): ReferencePageAtlasProjection {
  const projection = maceProjection();
  return {
    ...projection,
    projectionRef: ref("page-atlas-projection.generic", "6"),
    profile: "generic_paged_source",
    stagedKnowledge: {
      kind: "none",
      reason: "generic_profile_has_no_seed",
    },
  };
}

function maceProjection(): ReferencePageAtlasProjection {
  const atlasRef = ref("page-atlas.version-1", "e");
  const segmentRef = ref("page-atlas-segment.version-1", "f");
  return {
    schemaVersion: 1,
    projectionRef: ref("page-atlas-projection.version-1", "c"),
    workbenchSnapshotRef: STARTED_SNAPSHOT_REF,
    workbenchCardRef: CARD_REF,
    operationRef: ref("page-atlas-operation.fixture", "d"),
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
      atlasRef,
      version: 1,
      parentAtlasRef: null,
      state: "complete",
      coverage: {
        enumeratedPages: 310,
        rasterObservedPages: 1,
        contentCandidatePages: 1,
        mappingReviewedPages: 1,
        totalPages: 310,
        remainingPages: 0,
        percentComplete: 100,
        completeness: "complete",
      },
      checkpointRef: null,
      stop: null,
    },
    target: {
      targetRef: ref("page-atlas-target.page-75", "0"),
      scanPageNumber: 105,
      printedLocator: { state: "known", value: "75" },
      mappingState: "reviewed",
      canvas: {
        coordinateSystem: "normalized-top-left.v1",
        widthPixels: 818,
        heightPixels: 1_348,
        rotationDegrees: 0,
      },
      pageState: {
        enumeration: "enumerated",
        rasterization: "immutable_derivative_available",
        contentExtraction: "candidate_extracted",
        mappingReview: "owner_reviewed",
      },
    },
    citedSegmentLineage: {
      currentSegmentRef: segmentRef,
      versions: [segmentVersion(1, segmentRef, atlasRef, null, null, 105, "reviewed")],
    },
    confidence: {
      sourceIdentity: { state: "unknown", reason: "not_assessed" },
      pageMapping: { state: "assessed", value: 1, basis: "owner_review" },
      extraction: { state: "assessed", value: 0.92, basis: "typed_extraction" },
      interpretation: { state: "unknown", reason: "not_assessed" },
      applicability: { state: "unknown", reason: "not_assessed" },
    },
    stagedKnowledge: {
      kind: "mace_twelve_course_diapason_notation",
      candidateRef: ref("page-atlas-candidate.mace", "1"),
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
        questionRef: ref("page-atlas-question.course-13", "2"),
        course: 13,
        status: "open",
        historicalSignState: "unresolved",
        proposedSign: null,
        authorityState: "non_authoritative",
        question:
          "Which directly applicable historical source establishes the thirteenth-course sign?",
      },
    },
  };
}

function correctedMaceProjection(): ReferencePageAtlasProjection {
  const first = maceProjection();
  const oldSegment = first.citedSegmentLineage.versions[0]!;
  const atlasRef = ref("page-atlas.version-2", "3");
  const segmentRef = ref("page-atlas-segment.version-2", "4");
  return {
    ...first,
    projectionRef: ref("page-atlas-projection.version-2", "5"),
    workbenchSnapshotRef: CORRECTED_SNAPSHOT_REF,
    atlas: {
      ...first.atlas,
      atlasRef,
      version: 2,
      parentAtlasRef: first.atlas.atlasRef,
    },
    target: {
      ...first.target,
      targetRef: ref("page-atlas-target.page-75-corrected", "6"),
      scanPageNumber: 106,
      mappingState: "corrected",
    },
    citedSegmentLineage: {
      currentSegmentRef: segmentRef,
      versions: [
        { ...oldSegment, successorSegmentRef: segmentRef },
        segmentVersion(2, segmentRef, atlasRef, oldSegment.segmentRef, null, 106, "corrected"),
      ],
    },
  };
}

function segmentVersion(
  version: number,
  segmentRef: ReferencePageAtlasOpaqueHmacRef,
  pageAtlasRef: ReferencePageAtlasOpaqueHmacRef,
  parentSegmentRef: ReferencePageAtlasOpaqueHmacRef | null,
  successorSegmentRef: ReferencePageAtlasOpaqueHmacRef | null,
  scanPageNumber: number,
  mappingState: "reviewed" | "corrected"
): ReferencePageAtlasProjection["citedSegmentLineage"]["versions"][number] {
  return {
    segmentRef,
    version,
    parentSegmentRef,
    successorSegmentRef,
    pageAtlasRef,
    scanPageNumber,
    printedLocator: { state: "known", value: "75" },
    mappingState,
    citationState: "immutable",
    authorityState: "non_authoritative",
    previewState: "immutable_derivative_available",
    anchors: [
      anchor("image", "7", { x: 0.48, y: 0.52, width: 0.3, height: 0.14 }),
      anchor("text", "8", { x: 0.1, y: 0.64, width: 0.68, height: 0.12 }),
      anchor("notation", "9", { x: 0.51, y: 0.55, width: 0.25, height: 0.09 }),
    ],
  };
}

function anchor(
  kind: "image" | "text" | "notation",
  digest: string,
  region: { x: number; y: number; width: number; height: number }
): ReferencePageAtlasProjection["citedSegmentLineage"]["versions"][number]["anchors"][number] {
  return {
    anchorRef: ref(`page-atlas-anchor.${kind}`, digest),
    kind,
    region,
    reviewState: "reviewed",
    contentState: "withheld_local_only",
  };
}

function ref(suffix: string, digest: string): ReferencePageAtlasOpaqueHmacRef {
  return { id: `owner-reference-${suffix}`, digest: digest.repeat(64) };
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
