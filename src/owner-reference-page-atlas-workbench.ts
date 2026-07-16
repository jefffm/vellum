import { Value } from "@sinclair/typebox/value";

import { VellumApiError } from "./lib/api-contract.js";
import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
import {
  ReferencePageAtlasCancelRequestSchema,
  ReferencePageAtlasCorrectMappingRequestSchema,
  ReferencePageAtlasOpaqueHmacRefSchema,
  ReferencePageAtlasPendingRetryStateSchema,
  ReferencePageAtlasPreviewRequestSchema,
  ReferencePageAtlasProjectionSchema,
  ReferencePageAtlasReadRequestSchema,
  ReferencePageAtlasResumeRequestSchema,
  ReferencePageAtlasStartRequestSchema,
  ReferencePageAtlasStartedRetryStateSchema,
  type ReferencePageAtlasCancelRequest,
  type ReferencePageAtlasCorrectMappingRequest,
  type ReferencePageAtlasOpaqueHmacRef,
  type ReferencePageAtlasPendingRetryState,
  type ReferencePageAtlasPreviewRequest,
  type ReferencePageAtlasProfile,
  type ReferencePageAtlasProjection,
  type ReferencePageAtlasReadRequest,
  type ReferencePageAtlasResumeRequest,
  type ReferencePageAtlasStartRequest,
  type ReferencePageAtlasStartedRetryState,
} from "./lib/reference-page-atlas-contract.js";
import {
  createTypedKnowledgeReleaseWorkbench,
  type TypedKnowledgeReleaseWorkbenchCallbacks,
} from "./typed-knowledge-release-workbench.js";

export type OwnerReferencePageAtlasWorkbenchCallbacks = Readonly<{
  start: (request: ReferencePageAtlasStartRequest, signal?: AbortSignal) => Promise<unknown>;
  read: (request: ReferencePageAtlasReadRequest) => Promise<unknown>;
  preview: (
    request: ReferencePageAtlasPreviewRequest
  ) => Promise<OwnerReferencePageAtlasPreviewResult>;
  resume: (request: ReferencePageAtlasResumeRequest, signal?: AbortSignal) => Promise<unknown>;
  cancel: (request: ReferencePageAtlasCancelRequest) => Promise<unknown>;
  correctMapping: (
    request: ReferencePageAtlasCorrectMappingRequest,
    signal?: AbortSignal
  ) => Promise<unknown>;
  typedKnowledgeRelease?: TypedKnowledgeReleaseWorkbenchCallbacks;
}>;

export type OwnerReferencePageAtlasPreviewResult = Readonly<{
  blob: Blob;
  mediaType: "image/png";
}>;

export type OwnerReferencePageAtlasWorkbenchOptions = Readonly<{
  workbenchSnapshotRef: ReferencePageAtlasOpaqueHmacRef;
  workbenchCardRef: ReferencePageAtlasOpaqueHmacRef;
  initialPurpose?: string;
  initialProjection?: unknown;
}>;

export type OwnerReferencePageAtlasWorkbenchHandle = Readonly<{
  dialog: HTMLDialogElement;
  update: (projection: unknown) => ReferencePageAtlasProjection;
  close: () => void;
}>;

type WorkbenchState = {
  projection?: ReferencePageAtlasProjection;
  zoom: number;
  busy: boolean;
  closed: boolean;
  previewGeneration: number;
  previewObjectUrl?: string;
  activeMutationController?: AbortController;
};

type AvailableRetryState = {
  kind: "available";
  storage: Storage;
  started?: ReferencePageAtlasStartedRetryState;
  pending: Partial<Record<ReferencePageAtlasProfile, ReferencePageAtlasPendingRetryState>>;
};

type RetryStateInspection =
  | AvailableRetryState
  | { kind: "invalid"; storage: Storage }
  | { kind: "unavailable" };

type ProjectionSnapshotPolicy = "stable" | "successor_allowed";

type RetryStorageKeys = Readonly<{
  started: string;
  pending: Readonly<Record<ReferencePageAtlasProfile, string>>;
}>;

const activeWorkbenches = new WeakMap<Document, OwnerReferencePageAtlasWorkbenchHandle>();
const STARTED_RETRY_STORAGE_PREFIX = "vellum.owner-reference-page-atlas.started.v1";
const MAX_RETRY_STATE_BYTES = 1_024;
const DEFAULT_PURPOSE = "Build a resumable local Page Atlas and stage an exact cited segment";
const PROFILE_LABELS: Readonly<Record<ReferencePageAtlasProfile, string>> = Object.freeze({
  generic_paged_source: "Generic paged source",
  "mace-musicks-monument-1676": "Mace · Musick’s Monument (1676) seed",
});
const PENDING_RETRY_STORAGE_PREFIX: Readonly<Record<ReferencePageAtlasProfile, string>> =
  Object.freeze({
    generic_paged_source: "vellum.owner-reference-page-atlas.pending.generic-paged-source.v1",
    "mace-musicks-monument-1676":
      "vellum.owner-reference-page-atlas.pending.mace-musicks-monument-1676.v1",
  });

export function openOwnerReferencePageAtlasWorkbench(
  document: Document,
  options: OwnerReferencePageAtlasWorkbenchOptions,
  callbacks: OwnerReferencePageAtlasWorkbenchCallbacks
): OwnerReferencePageAtlasWorkbenchHandle {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const snapshotRef = Value.Decode(
    ReferencePageAtlasOpaqueHmacRefSchema,
    options.workbenchSnapshotRef
  );
  const cardRef = Value.Decode(ReferencePageAtlasOpaqueHmacRefSchema, options.workbenchCardRef);
  activeWorkbenches.get(document)?.close();

  const state: WorkbenchState = {
    zoom: 1,
    busy: false,
    closed: false,
    previewGeneration: 0,
  };
  const dialog = document.createElement("dialog");
  dialog.className = "owner-reference-page-atlas-workbench";
  dialog.setAttribute("aria-labelledby", "owner-reference-page-atlas-title");

  const header = document.createElement("header");
  header.className = "owner-reference-page-atlas-header";
  const titleGroup = document.createElement("div");
  const title = append(titleGroup, "h2", "Private Page Atlas Workbench");
  title.id = "owner-reference-page-atlas-title";
  append(
    titleGroup,
    "p",
    "Local extraction only · staged evidence · no specialist or historical authority",
    "owner-reference-page-atlas-subtitle"
  );
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close Workbench";
  header.append(titleGroup, closeButton);

  const boundary = document.createElement("p");
  boundary.className = "owner-reference-page-atlas-boundary";
  boundary.textContent =
    "Network access is disabled. This extraction grants no provider egress, fixture or repository inclusion, export, redistribution, or publication authority. A typed test-only release requires separate pack-citation rights verification. Source pixels and parser diagnostics never enter either projection.";

  const workspace = document.createElement("div");
  workspace.className = "owner-reference-page-atlas-layout";
  const controls = document.createElement("aside");
  controls.className = "owner-reference-page-atlas-controls";
  controls.setAttribute("aria-label", "Atlas operation controls");
  const page = document.createElement("main");
  page.className = "owner-reference-page-atlas-page";
  const review = document.createElement("aside");
  review.className = "owner-reference-page-atlas-review";
  review.setAttribute("aria-label", "Citation and staged knowledge review");
  workspace.append(controls, page, review);
  dialog.append(header, boundary, workspace);

  const retryKeys = retryStorageKeys(cardRef);
  const typedKnowledgeRelease = callbacks.typedKnowledgeRelease
    ? createTypedKnowledgeReleaseWorkbench(document, callbacks.typedKnowledgeRelease)
    : undefined;
  let retryState = inspectRetryState(document, cardRef);
  const revokePreview = () => {
    state.previewGeneration += 1;
    if (!state.previewObjectUrl) return;
    const Url = document.defaultView?.URL ?? globalThis.URL;
    Url.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = undefined;
  };
  const loadPreview = (
    projection: ReferencePageAtlasProjection,
    sheet: HTMLElement,
    placeholder: HTMLElement
  ) => {
    const segment = currentSegment(projection);
    if (!segment) {
      placeholder.textContent =
        "No cited segment is available yet. Source pixels remain unread until an exact segment is staged.";
      return;
    }
    if (segment.previewState === "regeneration_unavailable") {
      placeholder.textContent =
        "No protected immutable page derivative was retained. Vellum will not rerender current bytes and misrepresent that regeneration as citation replay.";
      return;
    }
    const generation = ++state.previewGeneration;
    placeholder.textContent = "Loading the exact cited segment from local-only storage…";
    const request = Value.Decode(ReferencePageAtlasPreviewRequestSchema, {
      ...operationRequest(projection, "preview"),
      projectionRef: projection.projectionRef,
      segmentRef: segment.segmentRef,
    });
    void callbacks
      .preview(request)
      .then((result) => {
        if (state.closed || generation !== state.previewGeneration) return;
        if (!validPreviewResult(document, result)) {
          throw new Error("Invalid private preview response");
        }
        const Url = document.defaultView?.URL ?? globalThis.URL;
        if (
          typeof Url.createObjectURL !== "function" ||
          typeof Url.revokeObjectURL !== "function"
        ) {
          throw new Error("Object URL support unavailable");
        }
        const objectUrl = Url.createObjectURL(result.blob);
        if (state.closed || generation !== state.previewGeneration) {
          Url.revokeObjectURL(objectUrl);
          return;
        }
        state.previewObjectUrl = objectUrl;
        const image = document.createElement("img");
        image.className = "owner-reference-page-atlas-private-preview";
        image.src = objectUrl;
        image.alt = `Private cited source segment for ${printedLocatorLabel(segment.printedLocator)}`;
        image.addEventListener(
          "error",
          () => {
            if (state.previewObjectUrl !== objectUrl) return;
            Url.revokeObjectURL(objectUrl);
            state.previewObjectUrl = undefined;
            image.remove();
            placeholder.textContent =
              "The private cited-segment preview could not be decoded. No source or parser diagnostics are displayed.";
          },
          { once: true }
        );
        sheet.prepend(image);
        placeholder.remove();
      })
      .catch(() => {
        if (state.closed || generation !== state.previewGeneration) return;
        placeholder.textContent =
          "The private cited-segment preview is unavailable. Source and parser diagnostics remain withheld; citation metadata is still reviewable.";
      });
  };
  const renderStart = () => {
    if (retryState.kind !== "available") {
      renderRetryRecovery(
        retryState.kind === "invalid"
          ? "Browser-local Atlas retry state is invalid, unknown, or oversized. It was not used and no source bytes were requested."
          : "Browser-local retry protection is unavailable. Local extraction is disabled so an uncertain operation cannot be duplicated.",
        undefined
      );
      return;
    }
    controls.replaceChildren();
    const heading = append(controls, "h3", "Start a local Page Atlas");
    heading.className = "owner-reference-page-atlas-section-title";
    append(
      controls,
      "p",
      "Choose the extraction profile yourself. The Mace seed runs only when the exact bytes match a registered public scan; Vellum never infers Mace—or any source identity—from a filename or profile selection.",
      "owner-reference-page-atlas-help"
    );
    const form = document.createElement("form");
    form.className = "owner-reference-page-atlas-start";

    const profileLabel = document.createElement("label");
    profileLabel.append("Extraction profile");
    const profile = document.createElement("select");
    profile.name = "profile";
    for (const value of Object.keys(PROFILE_LABELS) as ReferencePageAtlasProfile[]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = PROFILE_LABELS[value];
      profile.append(option);
    }
    profile.value = "generic_paged_source";
    profileLabel.append(profile);

    const purposeLabel = document.createElement("label");
    purposeLabel.append("Exact local purpose");
    const purpose = document.createElement("textarea");
    purpose.name = "purpose";
    purpose.required = true;
    purpose.maxLength = 512;
    purpose.value = options.initialPurpose?.trim() || DEFAULT_PURPOSE;
    purposeLabel.append(purpose);

    const attestationLabel = document.createElement("label");
    attestationLabel.className = "owner-reference-page-atlas-attestation";
    const attestation = document.createElement("input");
    attestation.type = "checkbox";
    attestation.setAttribute("aria-label", "Attest to local extraction only");
    attestationLabel.append(
      attestation,
      "I attest that I authorize this exact source and purpose for local extraction only. This grants no identity, historical, specialist, provider, fixture, export, redistribution, or publication authority."
    );

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Start local extraction";
    submit.disabled = true;
    const status = statusNode(document);
    form.append(profileLabel, purposeLabel, attestationLabel, submit, status);
    controls.append(form);

    const pendingForSelection = () =>
      retryState.kind === "available"
        ? retryState.pending[profile.value as ReferencePageAtlasProfile]
        : undefined;
    const explainPendingScope = () => {
      attestation.checked = false;
      submit.disabled = true;
      status.textContent = pendingForSelection()
        ? "A protected opaque retry identity exists for this card and profile. Re-enter the exact original purpose; the server will reject a different purpose without rotating the key."
        : "Review and attest to the exact local scope before starting extraction.";
    };
    explainPendingScope();
    profile.addEventListener("change", explainPendingScope);
    purpose.addEventListener("input", () => {
      attestation.checked = false;
      submit.disabled = true;
      status.textContent = pendingForSelection()
        ? "Purpose changed. Re-enter the exact original purpose and attest again; the protected retry identity will not be rotated."
        : "Purpose changed; review and attest to the exact local scope again.";
    });
    attestation.addEventListener("change", () => {
      submit.disabled = !attestation.checked || state.busy;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const exactPurpose = purpose.value.trim();
      if (!attestation.checked || exactPurpose.length === 0 || state.busy) return;
      const confirmed =
        document.defaultView?.confirm(
          "Start local extraction for this exact private reference and purpose? Network and provider access remain disabled; all results stay staged and non-authoritative."
        ) ?? false;
      if (!confirmed) {
        attestation.checked = false;
        submit.disabled = true;
        status.textContent = "Local extraction was cancelled. No source bytes were requested.";
        return;
      }
      let request: ReferencePageAtlasStartRequest;
      try {
        if (retryState.kind !== "available") {
          throw new Error("Browser-local retry protection unavailable");
        }
        const selectedProfile = profile.value as ReferencePageAtlasProfile;
        const pending =
          retryState.pending[selectedProfile] ??
          Value.Decode(ReferencePageAtlasPendingRetryStateSchema, {
            schemaVersion: 1,
            state: "pending",
            cardRef,
            operationKey: createOperationKey(document),
          });
        writeRetryState(retryState.storage, retryKeys.pending[selectedProfile], pending);
        retryState = inspectRetryState(document, cardRef);
        if (retryState.kind !== "available") {
          throw new Error("Browser-local retry state did not round-trip");
        }
        request = Value.Decode(ReferencePageAtlasStartRequestSchema, {
          schemaVersion: 1,
          action: "start",
          workbenchSnapshotRef: snapshotRef,
          workbenchCardRef: cardRef,
          purpose: exactPurpose,
          authorization: "owner_attested_local_extraction",
          operationKey: pending.operationKey,
          profile: selectedProfile,
          profileSelection: "owner_selected",
        });
      } catch {
        status.textContent =
          "Secure local retry identity is unavailable. No source bytes were requested.";
        return;
      }
      setBusy(true, submit, profile, purpose, attestation);
      status.textContent = "Starting bounded local extraction…";
      const controller = new AbortController();
      state.activeMutationController = controller;
      void callbacks
        .start(request, controller.signal)
        .then((value) => {
          const projection = validateProjection(value, request.profile, "successor_allowed");
          persistStartedRetry(projection);
          setBusy(false, submit, profile, purpose, attestation);
          commitProjection(projection);
        })
        .catch((error: unknown) => {
          status.textContent =
            error instanceof VellumApiError && error.status === 422
              ? "This extraction profile is unavailable for these exact bytes. A source-specific seed requires its registered scan; choose Generic paged source for any other PDF. Parser diagnostics remain withheld."
              : "The local extraction outcome could not be confirmed. Retry this unchanged profile and purpose to reuse the same private operation key; parser diagnostics are withheld.";
        })
        .finally(() => {
          if (state.activeMutationController === controller) {
            state.activeMutationController = undefined;
          }
          setBusy(false, submit, profile, purpose, attestation);
          attestation.checked = false;
          submit.disabled = true;
        });
    });
  };

  const setBusy = (
    busy: boolean,
    submit?: HTMLButtonElement,
    ...fields: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    state.busy = busy;
    if (submit) submit.disabled = busy || submit.disabled;
    for (const field of fields) field.disabled = busy;
  };

  const invoke = (
    action: "read" | "resume" | "cancel" | "correct_mapping",
    request:
      | ReferencePageAtlasReadRequest
      | ReferencePageAtlasResumeRequest
      | ReferencePageAtlasCancelRequest
      | ReferencePageAtlasCorrectMappingRequest,
    status: HTMLElement,
    expectedProfile: ReferencePageAtlasProfile,
    button: HTMLButtonElement
  ) => {
    if (state.busy && action !== "cancel") return;
    if (action !== "cancel") state.busy = true;
    button.disabled = true;
    status.textContent = `${operationProgressLabel(action)}…`;
    const controller =
      action === "resume" || action === "correct_mapping" ? new AbortController() : undefined;
    if (controller) state.activeMutationController = controller;
    const operation =
      action === "read"
        ? callbacks.read(request as ReferencePageAtlasReadRequest)
        : action === "resume"
          ? callbacks.resume(request as ReferencePageAtlasResumeRequest, controller?.signal)
          : action === "cancel"
            ? callbacks.cancel(request as ReferencePageAtlasCancelRequest)
            : callbacks.correctMapping(
                request as ReferencePageAtlasCorrectMappingRequest,
                controller?.signal
              );
    void operation
      .then((value) => {
        state.busy = false;
        return applyProjection(
          value,
          expectedProfile,
          action === "read" ? "stable" : "successor_allowed"
        );
      })
      .catch(() => {
        status.textContent =
          "The local Atlas operation could not be confirmed. Private diagnostics are withheld; refresh the exact operation before retrying a mutation.";
      })
      .finally(() => {
        if (state.activeMutationController === controller) {
          state.activeMutationController = undefined;
        }
        state.busy = false;
        button.disabled = false;
      });
  };

  const renderProjection = (projection: ReferencePageAtlasProjection) => {
    renderOperationControls(document, controls, projection, state, invoke);
    renderPageTarget(document, page, projection, state, loadPreview);
    renderReview(document, review, projection, state, invoke, typedKnowledgeRelease);
  };

  const validateProjection = (
    value: unknown,
    expectedProfile: ReferencePageAtlasProfile | undefined,
    snapshotPolicy: ProjectionSnapshotPolicy,
    expectedOperationRef?: ReferencePageAtlasOpaqueHmacRef
  ): ReferencePageAtlasProjection => {
    const projection = decodeProjection(value);
    const currentSnapshotRef = state.projection?.workbenchSnapshotRef ?? snapshotRef;
    if (!refsEqual(projection.workbenchCardRef, cardRef)) {
      throw new Error("Page Atlas projection does not match the opened Workbench scope");
    }
    if (
      snapshotPolicy === "stable" &&
      !refsEqual(projection.workbenchSnapshotRef, currentSnapshotRef)
    ) {
      throw new Error("Page Atlas read changed the current Workbench snapshot");
    }
    if (expectedProfile && projection.profile !== expectedProfile) {
      throw new Error("Page Atlas projection changed the Owner-selected profile");
    }
    if (
      (expectedOperationRef && !refsEqual(projection.operationRef, expectedOperationRef)) ||
      (state.projection && !refsEqual(projection.operationRef, state.projection.operationRef))
    ) {
      throw new Error("Page Atlas projection changed operation identity");
    }
    return projection;
  };

  const commitProjection = (
    projection: ReferencePageAtlasProjection
  ): ReferencePageAtlasProjection => {
    revokePreview();
    state.projection = projection;
    renderProjection(projection);
    return projection;
  };

  const applyProjection = (
    value: unknown,
    expectedProfile?: ReferencePageAtlasProfile,
    snapshotPolicy: ProjectionSnapshotPolicy = "successor_allowed"
  ): ReferencePageAtlasProjection =>
    commitProjection(validateProjection(value, expectedProfile, snapshotPolicy));

  const persistStartedRetry = (projection: ReferencePageAtlasProjection) => {
    if (retryState.kind !== "available") {
      throw new Error("Browser-local retry protection unavailable");
    }
    const started = Value.Decode(ReferencePageAtlasStartedRetryStateSchema, {
      schemaVersion: 1,
      state: "started",
      cardRef: projection.workbenchCardRef,
      operationRef: projection.operationRef,
      profile: projection.profile,
    });
    writeRetryState(retryState.storage, retryKeys.started, started);
    try {
      retryState.storage.removeItem(retryKeys.pending[projection.profile]);
    } catch {
      // The started pointer was already durably verified. A redundant pending
      // pointer contains no purpose or source data and remains fail-closed.
    }
    retryState = inspectRetryState(document, cardRef);
    if (
      retryState.kind !== "available" ||
      !retryState.started ||
      !refsEqual(retryState.started.operationRef, projection.operationRef)
    ) {
      throw new Error("Browser-local started retry state did not round-trip");
    }
  };

  const renderRetryRecovery = (message: string, retryRead?: () => void) => {
    controls.replaceChildren();
    append(
      controls,
      "h3",
      "Atlas retry protection needs attention",
      "owner-reference-page-atlas-section-title"
    );
    append(controls, "p", message, "owner-reference-page-atlas-stop");
    append(
      controls,
      "p",
      "No purpose, source identity, source bytes, content, diagnostics, snapshot, or direct content digest is stored in the browser retry record.",
      "owner-reference-page-atlas-help"
    );
    const actions = document.createElement("div");
    actions.className = "owner-reference-page-atlas-actions";
    if (retryRead) {
      const retry = actionButton(document, "Retry saved operation", "Retry saved Atlas operation");
      retry.addEventListener("click", retryRead);
      actions.append(retry);
    }
    if (retryState.kind !== "unavailable") {
      const resetStorage = retryState.storage;
      const reset = actionButton(
        document,
        "Reset browser retry state",
        "Reset browser-local Atlas retry state"
      );
      reset.addEventListener("click", () => {
        const confirmed =
          document.defaultView?.confirm(
            "Discard only the browser-local opaque Atlas retry pointers? This does not delete or cancel any server-local operation or source."
          ) ?? false;
        if (!confirmed) return;
        try {
          clearRetryState(resetStorage, retryKeys);
          retryState = inspectRetryState(document, cardRef);
        } catch {
          retryState = { kind: "unavailable" };
        }
        if (retryState.kind === "available") {
          state.projection = undefined;
          revokePreview();
          page.replaceChildren(emptyPanel(document, "No Atlas target yet"));
          review.replaceChildren(
            emptyPanel(
              document,
              "Browser-local retry identities were discarded. Re-enter an exact purpose and attest before starting again."
            )
          );
          renderStart();
        } else {
          renderRetryRecovery(
            "Browser-local retry state could not be safely reset. Local extraction remains disabled.",
            undefined
          );
        }
      });
      actions.append(reset);
    }
    controls.append(actions);
  };

  const readStartedRetry = (started: ReferencePageAtlasStartedRetryState) => {
    controls.replaceChildren();
    append(
      controls,
      "h3",
      "Restoring saved Atlas operation",
      "owner-reference-page-atlas-section-title"
    );
    const status = statusNode(document);
    status.textContent =
      "Reading the saved opaque operation against the current Workbench snapshot…";
    controls.append(status);
    const request = Value.Decode(ReferencePageAtlasReadRequestSchema, {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: snapshotRef,
      workbenchCardRef: cardRef,
      operationRef: started.operationRef,
    });
    void callbacks
      .read(request)
      .then((value) => {
        const projection = validateProjection(
          value,
          started.profile,
          "stable",
          started.operationRef
        );
        persistStartedRetry(projection);
        commitProjection(projection);
      })
      .catch(() => {
        renderRetryRecovery(
          "The saved local Atlas operation could not be confirmed. Its opaque pointer was retained; private diagnostics remain withheld.",
          () => readStartedRetry(started)
        );
      });
  };

  const close = () => {
    if (state.closed) return;
    state.closed = true;
    state.activeMutationController?.abort();
    state.activeMutationController = undefined;
    typedKnowledgeRelease?.close();
    revokePreview();
    dialog.remove();
    if (activeWorkbenches.get(document)?.dialog === dialog) activeWorkbenches.delete(document);
  };
  closeButton.addEventListener("click", () => {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else close();
  });
  dialog.addEventListener("close", close, { once: true });

  const handle = Object.freeze({ dialog, update: applyProjection, close });
  activeWorkbenches.set(document, handle);
  document.body.append(dialog);
  page.replaceChildren(emptyPanel(document, "No Atlas target yet"));
  review.replaceChildren(
    emptyPanel(
      document,
      "No source content has been read. Choose a profile and attest to local extraction to begin."
    )
  );
  try {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (retryState.kind !== "available") {
      renderStart();
    } else {
      if (options.initialProjection !== undefined) {
        applyProjection(options.initialProjection, undefined, "stable");
      }
      if (retryState.started) readStartedRetry(retryState.started);
      else if (!state.projection) renderStart();
    }
  } catch (error) {
    close();
    throw error;
  }
  return handle;
}

function renderOperationControls(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection,
  state: WorkbenchState,
  invoke: (
    action: "read" | "resume" | "cancel" | "correct_mapping",
    request:
      | ReferencePageAtlasReadRequest
      | ReferencePageAtlasResumeRequest
      | ReferencePageAtlasCancelRequest
      | ReferencePageAtlasCorrectMappingRequest,
    status: HTMLElement,
    expectedProfile: ReferencePageAtlasProfile,
    button: HTMLButtonElement
  ) => void
): void {
  container.replaceChildren();
  append(container, "h3", "Atlas progress", "owner-reference-page-atlas-section-title");
  const badges = document.createElement("div");
  badges.className = "owner-reference-page-atlas-badges";
  badges.append(
    badge(document, projection.atlas.state.replaceAll("_", " "), "state"),
    badge(document, "staging only", "staged"),
    badge(document, "non-authoritative", "warning")
  );
  container.append(badges);
  append(
    container,
    "p",
    `${PROFILE_LABELS[projection.profile]} · explicitly selected`,
    "owner-reference-page-atlas-help"
  );

  const progress = document.createElement("progress");
  progress.max = 100;
  progress.value = projection.atlas.coverage.percentComplete ?? 0;
  progress.setAttribute("aria-label", "Page Atlas completion");
  container.append(progress);
  const total = projection.atlas.coverage.totalPages;
  append(
    container,
    "p",
    `${projection.atlas.coverage.enumeratedPages}${total === null ? "" : ` of ${total}`} pages enumerated · ${projection.atlas.coverage.rasterObservedPages} raster observed · ${projection.atlas.coverage.contentCandidatePages} content candidate · ${projection.atlas.coverage.mappingReviewedPages} mapping reviewed · ${projection.atlas.coverage.completeness}`,
    "owner-reference-page-atlas-progress-copy"
  );
  if (projection.atlas.stop) {
    append(
      container,
      "p",
      `Stopped: ${projection.atlas.stop.reason.replaceAll("_", " ")} · diagnostics redacted`,
      "owner-reference-page-atlas-stop"
    );
  }

  const actions = document.createElement("div");
  actions.className = "owner-reference-page-atlas-actions";
  const refresh = actionButton(document, "Refresh", "Refresh Atlas projection");
  const resume = actionButton(document, "Resume", "Resume Atlas generation");
  const cancel = actionButton(document, "Cancel", "Cancel Atlas generation");
  resume.disabled = !["paused", "failed"].includes(projection.atlas.state);
  cancel.disabled = !["queued", "running", "paused"].includes(projection.atlas.state);
  const status = statusNode(document);
  actions.append(refresh, resume, cancel);
  container.append(actions, status);

  refresh.addEventListener("click", () =>
    invoke(
      "read",
      Value.Decode(ReferencePageAtlasReadRequestSchema, operationRequest(projection, "read")),
      status,
      projection.profile,
      refresh
    )
  );
  resume.addEventListener("click", () =>
    invoke(
      "resume",
      Value.Decode(ReferencePageAtlasResumeRequestSchema, {
        ...operationRequest(projection, "resume"),
        expectedProjectionRef: projection.projectionRef,
      }),
      status,
      projection.profile,
      resume
    )
  );
  cancel.addEventListener("click", () => {
    const confirmed =
      document.defaultView?.confirm(
        "Cancel this local Atlas run? Reviewed work remains immutable and a later resume requires an eligible checkpoint."
      ) ?? false;
    if (!confirmed) {
      status.textContent = "Cancellation was not sent.";
      return;
    }
    invoke(
      "cancel",
      Value.Decode(ReferencePageAtlasCancelRequestSchema, {
        ...operationRequest(projection, "cancel"),
        expectedProjectionRef: projection.projectionRef,
        reason: "owner_requested",
      }),
      status,
      projection.profile,
      cancel
    );
  });
  if (state.busy) {
    refresh.disabled = true;
    resume.disabled = true;
  }
}

function renderPageTarget(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection,
  state: WorkbenchState,
  loadPreview: (
    projection: ReferencePageAtlasProjection,
    sheet: HTMLElement,
    placeholder: HTMLElement
  ) => void
): void {
  container.replaceChildren();
  const heading = document.createElement("header");
  heading.className = "owner-reference-page-atlas-page-header";
  const printed = printedLocatorLabel(projection.target.printedLocator);
  const title = append(
    heading,
    "h3",
    `Scan page ${projection.target.scanPageNumber} · ${printed}`,
    "owner-reference-page-atlas-section-title"
  );
  title.setAttribute("data-atlas-target", "");
  const zoomControls = document.createElement("div");
  zoomControls.className = "owner-reference-page-atlas-zoom";
  const zoomOut = actionButton(document, "−", "Zoom out");
  const zoomReset = actionButton(document, "100%", "Reset zoom");
  const zoomIn = actionButton(document, "+", "Zoom in");
  zoomControls.append(zoomOut, zoomReset, zoomIn);
  heading.append(zoomControls);
  container.append(heading);

  const viewport = document.createElement("div");
  viewport.className = "owner-reference-page-atlas-viewport";
  const sheet = document.createElement("div");
  sheet.className = "owner-reference-page-atlas-sheet";
  sheet.setAttribute("role", "img");
  sheet.setAttribute(
    "aria-label",
    `${printed}, scan page ${projection.target.scanPageNumber}, with cited anchor geometry`
  );
  if (projection.target.canvas) {
    sheet.style.aspectRatio = `${projection.target.canvas.widthPixels} / ${projection.target.canvas.heightPixels}`;
    sheet.dataset.rotationDegrees = String(projection.target.canvas.rotationDegrees);
    title.textContent += ` · ${projection.target.canvas.widthPixels}×${projection.target.canvas.heightPixels}px · rotation ${projection.target.canvas.rotationDegrees}°`;
  }
  const withheld = document.createElement("p");
  withheld.textContent =
    "Private source image is available only through the local no-store preview boundary. Image, text, and notation anchor geometry remains visible without it.";
  sheet.append(withheld);
  const current = currentSegment(projection);
  for (const anchor of current?.anchors ?? []) {
    const marker = document.createElement("span");
    marker.className = `owner-reference-page-atlas-anchor owner-reference-page-atlas-anchor-${anchor.kind}`;
    marker.dataset.anchorKind = anchor.kind;
    marker.tabIndex = 0;
    marker.setAttribute("aria-label", `${anchor.kind} anchor · ${anchor.reviewState}`);
    marker.title = `${anchor.kind} anchor · ${anchor.reviewState}`;
    const label = document.createElement("span");
    label.className = "owner-reference-page-atlas-anchor-label";
    label.textContent = `${anchor.kind} · ${anchor.reviewState}`;
    marker.append(label);
    marker.style.left = `${anchor.region.x * 100}%`;
    marker.style.top = `${anchor.region.y * 100}%`;
    marker.style.width = `${anchor.region.width * 100}%`;
    marker.style.height = `${anchor.region.height * 100}%`;
    sheet.append(marker);
  }
  viewport.append(sheet);
  container.append(viewport);
  loadPreview(projection, sheet, withheld);

  const applyZoom = () => {
    sheet.style.width = `${42 * state.zoom}rem`;
    zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;
    zoomOut.disabled = state.zoom <= 0.5;
    zoomIn.disabled = state.zoom >= 2.5;
  };
  zoomOut.addEventListener("click", () => {
    state.zoom = Math.max(0.5, state.zoom - 0.25);
    applyZoom();
  });
  zoomReset.addEventListener("click", () => {
    state.zoom = 1;
    applyZoom();
  });
  zoomIn.addEventListener("click", () => {
    state.zoom = Math.min(2.5, state.zoom + 0.25);
    applyZoom();
  });
  applyZoom();
}

function renderReview(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection,
  state: WorkbenchState,
  invoke: (
    action: "read" | "resume" | "cancel" | "correct_mapping",
    request:
      | ReferencePageAtlasReadRequest
      | ReferencePageAtlasResumeRequest
      | ReferencePageAtlasCancelRequest
      | ReferencePageAtlasCorrectMappingRequest,
    status: HTMLElement,
    expectedProfile: ReferencePageAtlasProfile,
    button: HTMLButtonElement
  ) => void,
  typedKnowledgeRelease?: ReturnType<typeof createTypedKnowledgeReleaseWorkbench>
): void {
  container.replaceChildren();
  append(container, "h3", "Citation and extraction", "owner-reference-page-atlas-section-title");
  const badges = document.createElement("div");
  badges.className = "owner-reference-page-atlas-badges";
  badges.append(
    badge(document, "staged", "staged"),
    badge(document, "non-authoritative", "warning"),
    badge(document, "provider denied", "deny")
  );
  container.append(badges);

  renderConfidence(document, container, projection);
  renderStagedKnowledge(document, container, projection);
  typedKnowledgeRelease?.render(container, projection);
  renderLineage(document, container, projection);
  renderCorrection(document, container, projection, state, invoke);
}

function renderConfidence(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection
): void {
  const details = document.createElement("details");
  details.className = "owner-reference-page-atlas-confidence";
  const summary = document.createElement("summary");
  summary.textContent = "Independent confidence dimensions";
  const list = document.createElement("dl");
  for (const [name, assessment] of Object.entries(projection.confidence)) {
    const term = document.createElement("dt");
    term.textContent = splitCamelCase(name);
    const value = document.createElement("dd");
    value.textContent =
      assessment.state === "assessed"
        ? `${Math.round(assessment.value * 100)}% · ${assessment.basis.replaceAll("_", " ")}`
        : `unknown · ${assessment.reason.replaceAll("_", " ")}`;
    list.append(term, value);
  }
  details.append(summary, list);
  container.append(details);
}

function renderStagedKnowledge(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection
): void {
  const section = document.createElement("section");
  section.className = "owner-reference-page-atlas-knowledge";
  append(section, "h4", "Staged knowledge candidate");
  if (projection.stagedKnowledge.kind === "none") {
    const explanation =
      projection.stagedKnowledge.reason === "reextraction_required"
        ? "The corrected scan has an image citation only. Re-extraction is required; Vellum did not copy the predecessor page’s regions or transcription onto this page."
        : `No seed candidate · ${projection.stagedKnowledge.reason.replaceAll("_", " ")}. Generic PDFs remain fully usable for atlas and citation work.`;
    append(section, "p", explanation, "owner-reference-page-atlas-help");
    container.append(section);
    return;
  }
  append(
    section,
    "p",
    "Twelve-course diapason notation · staged · non-authoritative. Separate pack-citation rights are required for a test-only release; verified human review is required before authority or any arranging consequence.",
    "owner-reference-page-atlas-candidate-boundary"
  );
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Exact staged course-sign sequence";
  const body = document.createElement("tbody");
  for (const mapping of projection.stagedKnowledge.courseMappings) {
    const row = document.createElement("tr");
    const course = document.createElement("th");
    course.scope = "row";
    course.textContent = `Course ${mapping.course}`;
    const sign = document.createElement("td");
    sign.textContent = mapping.sign;
    row.append(course, sign);
    body.append(row);
  }
  table.append(caption, body);
  const question = document.createElement("p");
  question.className = "owner-reference-page-atlas-question";
  question.textContent = `Course 13 · open research question · ${projection.stagedKnowledge.course13Question.question} No sign is inferred.`;
  section.append(table, question);
  container.append(section);
}

function renderLineage(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection
): void {
  const section = document.createElement("section");
  section.className = "owner-reference-page-atlas-lineage";
  append(section, "h4", "Immutable cited-segment lineage");
  if (projection.citedSegmentLineage.versions.length === 0) {
    append(section, "p", "No cited segment has been staged yet.");
  } else {
    const list = document.createElement("ol");
    for (const version of projection.citedSegmentLineage.versions) {
      const item = document.createElement("li");
      const current = refsEqual(
        version.segmentRef,
        projection.citedSegmentLineage.currentSegmentRef
      );
      item.dataset.citationVersion = String(version.version);
      item.textContent = `v${version.version} · scan ${version.scanPageNumber} · ${printedLocatorLabel(version.printedLocator)} · ${version.mappingState} · ${current ? "current successor" : "immutable predecessor"}`;
      list.append(item);
    }
    section.append(list);
  }
  container.append(section);
}

function renderCorrection(
  document: Document,
  container: HTMLElement,
  projection: ReferencePageAtlasProjection,
  state: WorkbenchState,
  invoke: (
    action: "read" | "resume" | "cancel" | "correct_mapping",
    request:
      | ReferencePageAtlasReadRequest
      | ReferencePageAtlasResumeRequest
      | ReferencePageAtlasCancelRequest
      | ReferencePageAtlasCorrectMappingRequest,
    status: HTMLElement,
    expectedProfile: ReferencePageAtlasProfile,
    button: HTMLButtonElement
  ) => void
): void {
  const form = document.createElement("form");
  form.className = "owner-reference-page-atlas-correction";
  append(form, "h4", "Correct the printed/scan mapping");
  append(
    form,
    "p",
    "A correction creates a new Atlas and cited-segment version. The old citation remains immutable and resolves under its original mapping.",
    "owner-reference-page-atlas-help"
  );
  const scanLabel = document.createElement("label");
  scanLabel.append("Scan page");
  const scanPage = document.createElement("input");
  scanPage.type = "number";
  scanPage.min = "1";
  scanPage.required = true;
  scanPage.value = String(projection.target.scanPageNumber);
  scanLabel.append(scanPage);
  const printedLabel = document.createElement("label");
  printedLabel.append("Printed locator");
  const printed = document.createElement("input");
  printed.required = true;
  printed.maxLength = 64;
  printed.value =
    projection.target.printedLocator.state === "known"
      ? projection.target.printedLocator.value
      : "";
  printedLabel.append(printed);
  const reasonLabel = document.createElement("label");
  reasonLabel.append("Correction reason");
  const reason = document.createElement("textarea");
  reason.required = true;
  reason.maxLength = 512;
  reason.value = "Correct the printed-to-scan page mapping after local review";
  reasonLabel.append(reason);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Create successor citation mapping";
  const status = statusNode(document);
  form.append(scanLabel, printedLabel, reasonLabel, submit, status);
  container.append(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.busy) return;
    const scanPageNumber = Number(scanPage.value);
    const printedLocator = printed.value.trim();
    const exactReason = reason.value.trim();
    if (
      !Number.isInteger(scanPageNumber) ||
      scanPageNumber < 1 ||
      !printedLocator ||
      !exactReason
    ) {
      status.textContent = "Enter an exact positive scan page, printed locator, and reason.";
      return;
    }
    const confirmed =
      document.defaultView?.confirm(
        "Create a successor mapping while preserving the old Atlas and citation unchanged?"
      ) ?? false;
    if (!confirmed) {
      status.textContent = "Correction was not sent; the current lineage is unchanged.";
      return;
    }
    invoke(
      "correct_mapping",
      Value.Decode(ReferencePageAtlasCorrectMappingRequestSchema, {
        ...operationRequest(projection, "correct_mapping"),
        expectedProjectionRef: projection.projectionRef,
        correction: { scanPageNumber, printedLocator, reason: exactReason },
      }),
      status,
      projection.profile,
      submit
    );
  });
}

function decodeProjection(input: unknown): ReferencePageAtlasProjection {
  const projection = Value.Decode(ReferencePageAtlasProjectionSchema, input);
  const coverage = projection.atlas.coverage;
  if (
    coverage.rasterObservedPages > coverage.enumeratedPages ||
    coverage.contentCandidatePages > coverage.rasterObservedPages ||
    coverage.mappingReviewedPages > coverage.rasterObservedPages
  ) {
    throw new Error("Page Atlas page-state coverage exceeds its evidentiary basis");
  }
  if (coverage.totalPages === null) {
    if (
      coverage.remainingPages !== null ||
      coverage.percentComplete !== null ||
      coverage.completeness === "complete"
    ) {
      throw new Error("Page Atlas unknown total has incoherent completion fields");
    }
  } else {
    const expectedRemaining = coverage.totalPages - coverage.enumeratedPages;
    const expectedPercent = (coverage.enumeratedPages / coverage.totalPages) * 100;
    if (
      coverage.enumeratedPages > coverage.totalPages ||
      coverage.remainingPages !== expectedRemaining ||
      coverage.percentComplete === null ||
      Math.abs(coverage.percentComplete - expectedPercent) > 0.01
    ) {
      throw new Error("Page Atlas coverage is incoherent");
    }
    if (
      coverage.completeness === "complete" &&
      (expectedRemaining !== 0 || coverage.percentComplete !== 100)
    ) {
      throw new Error("Page Atlas complete coverage is incomplete");
    }
  }
  if (projection.atlas.state === "complete" && coverage.completeness !== "complete") {
    throw new Error("Completed Page Atlas has partial coverage");
  }
  if (["queued", "running", "complete"].includes(projection.atlas.state)) {
    if (projection.atlas.stop !== null) throw new Error("Active Page Atlas has a stop reason");
  }
  if (projection.atlas.state === "cancelled") {
    if (projection.atlas.stop?.reason !== "owner_cancelled") {
      throw new Error("Cancelled Page Atlas lacks its bounded stop reason");
    }
  }
  if (coverage.totalPages !== null && projection.target.scanPageNumber > coverage.totalPages) {
    throw new Error("Page Atlas target exceeds known scan coverage");
  }
  if (
    (projection.target.canvas === null) !==
    (projection.target.pageState.enumeration === "not_enumerated")
  ) {
    throw new Error("Page Atlas target canvas contradicts its enumeration state");
  }
  if (
    projection.target.pageState.rasterization === "immutable_derivative_available" &&
    projection.target.pageState.enumeration !== "enumerated"
  ) {
    throw new Error("Page Atlas immutable raster lacks an enumerated canvas");
  }

  const lineage = projection.citedSegmentLineage;
  if ((lineage.currentSegmentRef === null) !== (lineage.versions.length === 0)) {
    throw new Error("Page Atlas citation lineage has no coherent current segment");
  }
  for (const [index, version] of lineage.versions.entries()) {
    if (version.version !== index + 1) {
      throw new Error("Page Atlas citation lineage versions are not contiguous");
    }
    for (const anchor of version.anchors) {
      if (
        anchor.region.x + anchor.region.width > 1.000001 ||
        anchor.region.y + anchor.region.height > 1.000001
      ) {
        throw new Error("Page Atlas anchor exceeds normalized page bounds");
      }
    }
    if (
      version.previewState === "immutable_derivative_available" &&
      projection.target.pageState.rasterization !== "immutable_derivative_available" &&
      refsEqual(version.segmentRef, lineage.currentSegmentRef)
    ) {
      throw new Error("Page Atlas immutable preview lacks a retained derivative state");
    }
    const previous = lineage.versions[index - 1];
    const next = lineage.versions[index + 1];
    if (
      (previous === undefined) !== (version.parentSegmentRef === null) ||
      (previous && !refsEqual(version.parentSegmentRef, previous.segmentRef)) ||
      (next === undefined) !== (version.successorSegmentRef === null) ||
      (next && !refsEqual(version.successorSegmentRef, next.segmentRef))
    ) {
      throw new Error("Page Atlas citation lineage links are incoherent");
    }
  }
  const current = currentSegment(projection);
  if (current) {
    if (
      current.scanPageNumber !== projection.target.scanPageNumber ||
      JSON.stringify(current.printedLocator) !== JSON.stringify(projection.target.printedLocator)
    ) {
      throw new Error("Current cited segment does not match the exact Atlas target");
    }
    if (projection.target.pageState.rasterization === "not_rasterized") {
      throw new Error("Current cited segment lacks a raster observation");
    }
  } else if (projection.target.pageState.rasterization !== "not_rasterized") {
    throw new Error("Uncited Atlas target claims a raster observation");
  }

  if (projection.stagedKnowledge.kind === "mace_twelve_course_diapason_notation") {
    if (projection.profile !== "mace-musicks-monument-1676" || !current) {
      throw new Error("Mace seed knowledge is outside its explicit profile or citation");
    }
    const anchorKinds = new Set(current.anchors.map(({ kind }) => kind));
    if (!(["image", "text", "notation"] as const).every((kind) => anchorKinds.has(kind))) {
      throw new Error("Mace cited extraction lacks image, text, and notation anchors");
    }
  } else if (
    projection.profile === "generic_paged_source" &&
    projection.stagedKnowledge.reason !== "generic_profile_has_no_seed"
  ) {
    throw new Error("Generic Page Atlas projection manufactured seed knowledge");
  } else if (projection.stagedKnowledge.reason === "reextraction_required") {
    if (
      projection.profile !== "mace-musicks-monument-1676" ||
      !current ||
      projection.target.pageState.contentExtraction !== "not_extracted" ||
      current.anchors.length !== 1 ||
      current.anchors[0]?.kind !== "image"
    ) {
      throw new Error("Mace re-extraction state lacks its exact image-only successor citation");
    }
  }
  if (
    projection.profile === "mace-musicks-monument-1676" &&
    projection.atlas.state === "complete" &&
    projection.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation" &&
    projection.stagedKnowledge.reason !== "reextraction_required"
  ) {
    throw new Error("Completed Mace seed extraction omitted its staged candidate");
  }
  return projection;
}

function currentSegment(
  projection: ReferencePageAtlasProjection
): ReferencePageAtlasProjection["citedSegmentLineage"]["versions"][number] | undefined {
  const currentRef = projection.citedSegmentLineage.currentSegmentRef;
  if (!currentRef) return undefined;
  return projection.citedSegmentLineage.versions.find(({ segmentRef }) =>
    refsEqual(segmentRef, currentRef)
  );
}

function operationRequest(
  projection: ReferencePageAtlasProjection,
  action: "read" | "preview" | "resume" | "cancel" | "correct_mapping"
): {
  schemaVersion: 1;
  action: typeof action;
  workbenchSnapshotRef: ReferencePageAtlasOpaqueHmacRef;
  workbenchCardRef: ReferencePageAtlasOpaqueHmacRef;
  operationRef: ReferencePageAtlasOpaqueHmacRef;
} {
  return {
    schemaVersion: 1,
    action,
    workbenchSnapshotRef: projection.workbenchSnapshotRef,
    workbenchCardRef: projection.workbenchCardRef,
    operationRef: projection.operationRef,
  };
}

function inspectRetryState(
  document: Document,
  expectedCardRef: ReferencePageAtlasOpaqueHmacRef
): RetryStateInspection {
  const keys = retryStorageKeys(expectedCardRef);
  let storage: Storage;
  try {
    const candidate = document.defaultView?.localStorage;
    if (!candidate) return { kind: "unavailable" };
    storage = candidate;
  } catch {
    return { kind: "unavailable" };
  }

  try {
    const startedRaw = storage.getItem(keys.started);
    const started =
      startedRaw === null
        ? undefined
        : Value.Decode(
            ReferencePageAtlasStartedRetryStateSchema,
            parseBoundedRetryJson(startedRaw)
          );
    if (started && !refsEqual(started.cardRef, expectedCardRef)) {
      return { kind: "invalid", storage };
    }

    const pending: Partial<Record<ReferencePageAtlasProfile, ReferencePageAtlasPendingRetryState>> =
      {};
    for (const profile of Object.keys(keys.pending) as ReferencePageAtlasProfile[]) {
      const raw = storage.getItem(keys.pending[profile]);
      if (raw === null) continue;
      const decoded = Value.Decode(
        ReferencePageAtlasPendingRetryStateSchema,
        parseBoundedRetryJson(raw)
      );
      if (!refsEqual(decoded.cardRef, expectedCardRef)) {
        return { kind: "invalid", storage };
      }
      pending[profile] = decoded;
    }
    return { kind: "available", storage, started, pending };
  } catch {
    return { kind: "invalid", storage };
  }
}

function retryStorageKeys(cardRef: ReferencePageAtlasOpaqueHmacRef): RetryStorageKeys {
  return Object.freeze({
    started: `${STARTED_RETRY_STORAGE_PREFIX}.${cardRef.id}`,
    pending: Object.freeze({
      generic_paged_source: `${PENDING_RETRY_STORAGE_PREFIX.generic_paged_source}.${cardRef.id}`,
      "mace-musicks-monument-1676": `${PENDING_RETRY_STORAGE_PREFIX["mace-musicks-monument-1676"]}.${cardRef.id}`,
    }),
  });
}

function parseBoundedRetryJson(raw: string): unknown {
  if (new TextEncoder().encode(raw).byteLength > MAX_RETRY_STATE_BYTES) {
    throw new Error("Browser-local Atlas retry state exceeds its bound");
  }
  return JSON.parse(raw) as unknown;
}

function writeRetryState(
  storage: Storage,
  key: string,
  retryState: ReferencePageAtlasPendingRetryState | ReferencePageAtlasStartedRetryState
): void {
  const decoded =
    retryState.state === "pending"
      ? Value.Decode(ReferencePageAtlasPendingRetryStateSchema, retryState)
      : Value.Decode(ReferencePageAtlasStartedRetryStateSchema, retryState);
  const serialized = JSON.stringify(decoded);
  if (new TextEncoder().encode(serialized).byteLength > MAX_RETRY_STATE_BYTES) {
    throw new Error("Browser-local Atlas retry state exceeds its bound");
  }
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized) {
    throw new Error("Browser-local Atlas retry state did not persist exactly");
  }
}

function clearRetryState(storage: Storage, scopedKeys: RetryStorageKeys): void {
  const keys = [scopedKeys.started, ...Object.values(scopedKeys.pending)];
  for (const key of keys) storage.removeItem(key);
  if (keys.some((key) => storage.getItem(key) !== null)) {
    throw new Error("Browser-local Atlas retry state could not be cleared");
  }
}

function validPreviewResult(
  document: Document,
  value: unknown
): value is OwnerReferencePageAtlasPreviewResult {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("blob") || !keys.includes("mediaType")) return false;
  const candidate = value as { blob?: unknown; mediaType?: unknown };
  const BlobConstructor = document.defaultView?.Blob ?? globalThis.Blob;
  return (
    typeof BlobConstructor === "function" &&
    candidate.blob instanceof BlobConstructor &&
    candidate.blob.size > 0 &&
    candidate.blob.type === "image/png" &&
    candidate.mediaType === "image/png"
  );
}

function createOperationKey(document: Document): string {
  const crypto = document.defaultView?.crypto ?? globalThis.crypto;
  if (!crypto?.getRandomValues) throw new Error("Secure random source unavailable");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  const encode = document.defaultView?.btoa?.bind(document.defaultView) ?? globalThis.btoa;
  if (!encode) throw new Error("Base64 encoder unavailable");
  const encoded = encode(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `owner-page-atlas.v1.${encoded}`;
}

function printedLocatorLabel(
  locator: ReferencePageAtlasProjection["target"]["printedLocator"]
): string {
  return locator.state === "known" ? `printed page ${locator.value}` : "printed page unresolved";
}

function refsEqual(
  left: ReferencePageAtlasOpaqueHmacRef | null,
  right: ReferencePageAtlasOpaqueHmacRef | null
): boolean {
  return left === null
    ? right === null
    : right !== null && left.id === right.id && left.digest === right.digest;
}

function operationProgressLabel(action: "read" | "resume" | "cancel" | "correct_mapping"): string {
  switch (action) {
    case "read":
      return "Refreshing local Atlas state";
    case "resume":
      return "Resuming bounded local extraction";
    case "cancel":
      return "Cancelling local extraction";
    case "correct_mapping":
      return "Creating an immutable successor mapping";
  }
}

function actionButton(document: Document, text: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}

function badge(document: Document, text: string, kind: string): HTMLElement {
  const node = document.createElement("span");
  node.className = `owner-reference-page-atlas-badge owner-reference-page-atlas-badge-${kind}`;
  node.textContent = text;
  return node;
}

function statusNode(document: Document): HTMLParagraphElement {
  const status = document.createElement("p");
  status.className = "owner-reference-page-atlas-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  return status;
}

function emptyPanel(document: Document, text: string): HTMLElement {
  const panel = document.createElement("p");
  panel.className = "owner-reference-page-atlas-empty";
  panel.textContent = text;
  return panel;
}

function splitCamelCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function append(
  parent: HTMLElement,
  tag: "h2" | "h3" | "h4" | "p",
  text: string,
  className?: string
): HTMLElement {
  const node = parent.ownerDocument.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}
