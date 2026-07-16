import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
import type { ReferencePageAtlasProjection } from "./lib/reference-page-atlas-contract.js";
import {
  TypedKnowledgeReleaseOperationRequestSchema,
  TypedKnowledgeReleaseProjectionSchema,
  TypedKnowledgeReleasePublishRequestSchema,
  TypedKnowledgeReleasePreviewRequestSchema,
  type TypedKnowledgeReleaseOperationRequest,
  type TypedKnowledgeReleaseProjection,
  type TypedKnowledgeReleaseSelection,
} from "./lib/typed-knowledge-release-contract.js";

export type TypedKnowledgeReleaseWorkbenchCallbacks = Readonly<{
  operate: (
    request: TypedKnowledgeReleaseOperationRequest,
    signal?: AbortSignal
  ) => Promise<unknown>;
}>;

export type TypedKnowledgeReleaseWorkbenchHandle = Readonly<{
  render: (container: HTMLElement, pageAtlas: ReferencePageAtlasProjection) => void;
  close: () => void;
}>;

type WorkbenchState = {
  closed: boolean;
  busy: boolean;
  publishRequiresPreview: boolean;
  selection?: TypedKnowledgeReleaseSelection;
  selectionKey?: string;
  projection?: TypedKnowledgeReleaseProjection;
  status?: string;
  container?: HTMLElement;
  controller?: AbortController;
};

/**
 * Render the narrow T12 candidate -> draft -> immutable release comparison.
 *
 * The handle accepts only an already-decoded Page Atlas projection. It never
 * receives source bytes, graph identities, rights assertions, reviewer data,
 * arbitrary pack content, or activation input.
 */
export function createTypedKnowledgeReleaseWorkbench(
  document: Document,
  callbacks: TypedKnowledgeReleaseWorkbenchCallbacks
): TypedKnowledgeReleaseWorkbenchHandle {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const state: WorkbenchState = {
    closed: false,
    busy: false,
    publishRequiresPreview: false,
  };

  const render = (container: HTMLElement, pageAtlas: ReferencePageAtlasProjection): void => {
    if (state.closed) return;
    state.container = container;
    if (pageAtlas.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
      container.querySelector(".typed-knowledge-release-workbench")?.remove();
      resetSelection(state);
      return;
    }

    const selection = selectionFromPageAtlas(pageAtlas);
    const selectionKey = canonicalSelectionKey(selection);
    if (state.selectionKey !== selectionKey) {
      state.controller?.abort();
      state.controller = undefined;
      state.busy = false;
      state.publishRequiresPreview = false;
      state.projection = undefined;
      state.status = undefined;
      state.selection = selection;
      state.selectionKey = selectionKey;
    }
    draw(document, state, callbacks);
  };

  const close = (): void => {
    if (state.closed) return;
    state.closed = true;
    state.controller?.abort();
    state.container?.querySelector(".typed-knowledge-release-workbench")?.remove();
    state.controller = undefined;
    state.container = undefined;
    state.selection = undefined;
    state.projection = undefined;
  };

  return Object.freeze({ render, close });
}

function draw(
  document: Document,
  state: WorkbenchState,
  callbacks: TypedKnowledgeReleaseWorkbenchCallbacks,
  restoreFocusTo?: "preview" | "publish"
): void {
  const { container, selection } = state;
  if (!container || !selection) return;
  container.querySelector(".typed-knowledge-release-workbench")?.remove();

  const section = document.createElement("section");
  section.className = "typed-knowledge-release-workbench";
  section.setAttribute("aria-labelledby", "typed-knowledge-release-title");
  const title = document.createElement("h4");
  title.id = "typed-knowledge-release-title";
  title.textContent = "Immutable knowledge release comparison";
  const boundary = document.createElement("p");
  boundary.className = "typed-knowledge-release-boundary";
  boundary.textContent =
    "This exact staged Mace candidate can become an immutable test-only release only when the displayed publication boundary is configured; exact authority is still checked on Publish. No human or historical authority is granted, and default activation remains denied.";
  section.append(title, boundary);

  if (state.projection) {
    section.append(renderComparison(document, state.projection));
  } else {
    const empty = document.createElement("p");
    empty.className = "typed-knowledge-release-empty";
    empty.textContent =
      "Preview the typed candidate, draft, and immutable release before publishing anything.";
    section.append(empty);
  }

  const actions = document.createElement("div");
  actions.className = "typed-knowledge-release-actions";
  const preview = actionButton(
    document,
    "Preview typed release",
    "Preview typed knowledge release"
  );
  preview.disabled = state.busy;
  preview.addEventListener("click", () =>
    invoke(document, state, callbacks, "preview", preview, status)
  );
  actions.append(preview);

  let publish: HTMLButtonElement | undefined;
  if (
    state.projection?.publicationState === "candidate" &&
    state.projection.publicationCapability.state === "configured" &&
    !state.publishRequiresPreview
  ) {
    const publishButton = actionButton(
      document,
      "Publish immutable test-only release",
      "Publish immutable test-only knowledge release"
    );
    publish = publishButton;
    publishButton.disabled = state.busy;
    publishButton.addEventListener("click", () =>
      invoke(document, state, callbacks, "publish", publishButton, status)
    );
    actions.append(publishButton);
  }

  const status = document.createElement("p");
  status.className = "typed-knowledge-release-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = state.status ?? "";
  section.append(actions, status);
  container.append(section);
  if (restoreFocusTo) {
    const focusTarget = restoreFocusTo === "publish" ? (publish ?? preview) : preview;
    focusTarget.focus({ preventScroll: true });
  }
}

function renderComparison(
  document: Document,
  projection: TypedKnowledgeReleaseProjection
): HTMLElement {
  const comparison = document.createElement("div");
  comparison.className = "typed-knowledge-release-comparison";
  comparison.append(
    comparisonCard(
      document,
      "Candidate",
      projection.candidate.mappingCandidateRef,
      "Historical-practice lane · non-activating cited proposal"
    ),
    comparisonCard(
      document,
      "Draft",
      projection.draft.draftRef,
      `Mutable authoring state · content ${projection.draft.contentMerkleRoot} · closure ${projection.draft.closureMerkleRoot}`
    ),
    comparisonCard(
      document,
      "Immutable release",
      projection.release.releaseRef,
      `Sequence ${projection.release.sequence} · content ${projection.release.contentMerkleRoot} · Merkle ${projection.release.merkleRoot}`
    )
  );

  const courseQuestion = comparisonCard(
    document,
    "Open question",
    projection.candidate.course13QuestionCandidateRef,
    "Course 13 remains unresolved and cannot activate a historical sign"
  );
  courseQuestion.classList.add("typed-knowledge-release-card-question");
  comparison.append(courseQuestion);

  const lifecycle = document.createElement("dl");
  lifecycle.className = "typed-knowledge-release-lifecycle";
  definition(
    document,
    lifecycle,
    "Release lineage",
    projection.release.successorState === "successor"
      ? `Immutable successor of ${formatRef(projection.release.predecessorReleaseRef!)}`
      : "Initial immutable release"
  );
  definition(
    document,
    lifecycle,
    "Pack-citation authority",
    projection.packCitationAuthority === "verified_for_publication"
      ? "Verified for this publication"
      : "Not evaluated"
  );
  definition(document, lifecycle, "Publication capability", publicationCapabilityLabel(projection));
  definition(
    document,
    lifecycle,
    "Test attestation",
    projection.testAttestation.state === "issued_test_only"
      ? `Issued test-only · ${formatRef(projection.testAttestation.attestationRef)}`
      : "Not issued"
  );
  definition(document, lifecycle, "Default activation", "Denied · no activation decision exists");
  definition(
    document,
    lifecycle,
    "Publication head",
    projection.publicationHead
      ? `${projection.publicationHead.id} · r${projection.publicationHead.revision} · ${projection.publicationHead.digest}`
      : "No publication generation"
  );
  if (projection.publicationOutcome === "preview_existing") {
    definition(document, lifecycle, "Result", "Existing immutable publication found by preview");
  } else if (projection.publicationOutcome === "publish_idempotent") {
    definition(
      document,
      lifecycle,
      "Result",
      "Existing immutable publication confirmed by idempotent publish"
    );
  } else if (projection.publicationOutcome === "publish_committed") {
    definition(document, lifecycle, "Result", "New immutable publication generation committed");
  }
  comparison.append(lifecycle);
  return comparison;
}

function comparisonCard(
  document: Document,
  label: string,
  ref: Readonly<{ id: string; digest: string }>,
  explanation: string
): HTMLElement {
  const article = document.createElement("article");
  article.className = "typed-knowledge-release-card";
  const heading = document.createElement("strong");
  heading.textContent = label;
  const identity = document.createElement("code");
  identity.textContent = formatRef(ref);
  const detail = document.createElement("p");
  detail.textContent = explanation;
  article.append(heading, identity, detail);
  return article;
}

function definition(
  document: Document,
  list: HTMLDListElement,
  termText: string,
  valueText: string
): void {
  const term = document.createElement("dt");
  term.textContent = termText;
  const value = document.createElement("dd");
  value.textContent = valueText;
  list.append(term, value);
}

function invoke(
  document: Document,
  state: WorkbenchState,
  callbacks: TypedKnowledgeReleaseWorkbenchCallbacks,
  action: "preview" | "publish",
  button: HTMLButtonElement,
  status: HTMLElement
): void {
  if (state.busy || state.closed || !state.selection) return;
  const selectionKey = state.selectionKey;
  const selection = state.selection;
  let request: TypedKnowledgeReleaseOperationRequest;
  if (action === "preview") {
    request = Value.Decode(TypedKnowledgeReleasePreviewRequestSchema, {
      schemaVersion: 1,
      action,
      selection,
    });
  } else {
    if (
      !state.projection ||
      state.projection.publicationState !== "candidate" ||
      state.projection.publicationCapability.state !== "configured" ||
      state.publishRequiresPreview
    ) {
      return;
    }
    request = Value.Decode(TypedKnowledgeReleasePublishRequestSchema, {
      schemaVersion: 1,
      action,
      selection,
      expectedPublicationHead: state.projection.publicationHead,
    });
  }
  request = Value.Decode(TypedKnowledgeReleaseOperationRequestSchema, request);

  const controller = new AbortController();
  state.controller?.abort();
  state.controller = controller;
  state.busy = true;
  state.publishRequiresPreview = true;
  button.disabled = true;
  state.status =
    action === "preview"
      ? "Building a closed typed-release preview…"
      : "Publishing one immutable test-only generation…";
  status.textContent = state.status;

  void callbacks
    .operate(request, controller.signal)
    .then((value) => {
      if (state.closed || state.selectionKey !== selectionKey) return;
      const projection = decodeProjection(value, selection, action);
      state.projection = projection;
      state.publishRequiresPreview = false;
      state.status = publicationStatus(projection);
      status.textContent = state.status;
    })
    .catch(() => {
      if (state.closed || state.selectionKey !== selectionKey) return;
      state.status =
        action === "publish"
          ? "Publication was not confirmed. Preview again to resolve the exact idempotent result before retrying."
          : "The typed release preview is unavailable. The staged candidate remains unchanged.";
      status.textContent = state.status;
    })
    .finally(() => {
      if (state.closed || state.selectionKey !== selectionKey) return;
      if (state.controller === controller) state.controller = undefined;
      state.busy = false;
      if (state.container) {
        draw(document, state, callbacks, action);
      }
    });
}

function decodeProjection(
  value: unknown,
  selection: TypedKnowledgeReleaseSelection,
  action: "preview" | "publish"
): TypedKnowledgeReleaseProjection {
  const projection = Value.Decode(TypedKnowledgeReleaseProjectionSchema, value);
  if (!selectionsEqual(projection.selection, selection)) {
    throw new Error("Typed release projection changed its exact Page Atlas selection");
  }
  if (!refsEqual(projection.release.sourceDraftRef, projection.draft.draftRef)) {
    throw new Error("Typed release projection has incoherent draft lineage");
  }
  if (projection.release.contentMerkleRoot !== projection.draft.contentMerkleRoot) {
    throw new Error("Typed release projection has incoherent Merkle roots");
  }
  if (projection.release.merkleRoot !== projection.draft.closureMerkleRoot) {
    throw new Error("Typed release projection has incoherent closure Merkle roots");
  }
  if (
    (projection.release.successorState === "initial" &&
      projection.release.predecessorReleaseRef !== null) ||
    (projection.release.successorState === "successor" &&
      projection.release.predecessorReleaseRef === null)
  ) {
    throw new Error("Typed release projection has incoherent successor state");
  }
  if (
    (action === "preview" &&
      projection.publicationOutcome !== "preview_candidate" &&
      projection.publicationOutcome !== "preview_existing") ||
    (action === "publish" &&
      projection.publicationOutcome !== "publish_committed" &&
      projection.publicationOutcome !== "publish_idempotent")
  ) {
    throw new Error("Typed release projection outcome does not match the requested operation");
  }
  return projection;
}

function selectionFromPageAtlas(
  projection: ReferencePageAtlasProjection
): TypedKnowledgeReleaseSelection {
  if (projection.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
    throw new Error("Typed release requires an exact Mace staged candidate");
  }
  return {
    workbenchSnapshotRef: projection.workbenchSnapshotRef,
    workbenchCardRef: projection.workbenchCardRef,
    operationRef: projection.operationRef,
    expectedProjectionRef: projection.projectionRef,
    candidateRef: projection.stagedKnowledge.candidateRef,
  };
}

function resetSelection(state: WorkbenchState): void {
  state.controller?.abort();
  state.controller = undefined;
  state.busy = false;
  state.publishRequiresPreview = false;
  state.selection = undefined;
  state.selectionKey = undefined;
  state.projection = undefined;
  state.status = undefined;
}

function publicationCapabilityLabel(projection: TypedKnowledgeReleaseProjection): string {
  if (projection.publicationCapability.state === "configured") {
    return "Publication boundary configured · exact authority is checked on Publish";
  }
  const missing = projection.publicationCapability.missingPrerequisites.map((prerequisite) =>
    prerequisite === "pack_citation_authority"
      ? "pack-citation authority provider"
      : "system identity"
  );
  return `Unavailable · missing ${formatList(missing)}`;
}

function publicationStatus(projection: TypedKnowledgeReleaseProjection): string {
  switch (projection.publicationOutcome) {
    case "preview_candidate":
      return projection.publicationCapability.state === "configured"
        ? "Preview ready. Review every digest before publishing."
        : `Preview ready. ${publicationCapabilityLabel(projection)}; the staged candidate remains unchanged.`;
    case "preview_existing":
      return "An existing immutable test-only release was found. Default activation remains denied.";
    case "publish_committed":
      return "Immutable test-only release published. Default activation remains denied.";
    case "publish_idempotent":
      return "The existing immutable test-only release was confirmed. Default activation remains denied.";
  }
}

function formatList(values: readonly string[]): string {
  if (values.length < 2) return values[0] ?? "required publication prerequisites";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function canonicalSelectionKey(selection: TypedKnowledgeReleaseSelection): string {
  return [
    selection.workbenchSnapshotRef,
    selection.workbenchCardRef,
    selection.operationRef,
    selection.expectedProjectionRef,
    selection.candidateRef,
  ]
    .flatMap((ref) => [ref.id, ref.digest])
    .join("\u0000");
}

function refsEqual(
  left: Readonly<{ id: string; digest: string }>,
  right: Readonly<{ id: string; digest: string }>
): boolean {
  return left.id === right.id && left.digest === right.digest;
}

function selectionsEqual(
  left: TypedKnowledgeReleaseSelection,
  right: TypedKnowledgeReleaseSelection
): boolean {
  return (
    refsEqual(left.workbenchSnapshotRef, right.workbenchSnapshotRef) &&
    refsEqual(left.workbenchCardRef, right.workbenchCardRef) &&
    refsEqual(left.operationRef, right.operationRef) &&
    refsEqual(left.expectedProjectionRef, right.expectedProjectionRef) &&
    refsEqual(left.candidateRef, right.candidateRef)
  );
}

function formatRef(ref: Readonly<{ id: string; digest: string }>): string {
  return `${ref.id} · ${ref.digest}`;
}

function actionButton(document: Document, text: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}
