import { Value } from "@sinclair/typebox/value";

import {
  OwnerReferenceWorkbenchLocalOperationReviewResultSchema,
  OwnerReferenceWorkbenchSnapshotSchema,
  type OwnerReferenceWorkbenchAccessOperation,
  type OwnerReferenceWorkbenchCard,
  type OwnerReferenceWorkbenchLocalOperationReviewRequest,
  type OwnerReferenceWorkbenchLocalOperationReviewResult,
  type OwnerReferenceWorkbenchSnapshot,
} from "./lib/owner-reference-workbench-contract.js";
import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";

const EXPECTED_ACCESS = new Map<OwnerReferenceWorkbenchAccessOperation, "deny" | "review_required">(
  [
    ["local_study", "review_required"],
    ["local_extraction", "review_required"],
    ["provider_egress", "deny"],
    ["fixture_inclusion", "deny"],
    ["repository_inclusion", "deny"],
    ["export", "deny"],
    ["redistribution", "deny"],
    ["report", "deny"],
    ["log", "deny"],
  ]
);

export type OwnerReferenceWorkbenchUpload = (file: File) => Promise<unknown>;
export type OwnerReferenceWorkbenchUploadFailureKind =
  | "invalid_file"
  | "preflight_unavailable"
  | "retry_protection_unavailable"
  | "retry_state_invalid"
  | "pending_limit"
  | "outcome_uncertain";

export class OwnerReferenceWorkbenchUploadError extends Error {
  readonly kind: OwnerReferenceWorkbenchUploadFailureKind;

  constructor(kind: OwnerReferenceWorkbenchUploadFailureKind) {
    super(kind);
    this.name = "OwnerReferenceWorkbenchUploadError";
    this.kind = kind;
  }
}

export type OwnerReferenceWorkbenchUploadRecovery = () => Promise<void>;
export type OwnerReferenceWorkbenchLocalReview = (
  request: OwnerReferenceWorkbenchLocalOperationReviewRequest
) => Promise<OwnerReferenceWorkbenchLocalOperationReviewResult>;
export type OwnerReferenceWorkbenchLocalStudyFailureKind =
  | "retry_protection_unavailable"
  | "retry_state_invalid"
  | "pending_limit"
  | "operation_key_conflict"
  | "stale_before_commit"
  | "unavailable"
  | "invalid_response"
  | "outcome_uncertain";

export class OwnerReferenceWorkbenchLocalStudyError extends Error {
  readonly kind: OwnerReferenceWorkbenchLocalStudyFailureKind;

  constructor(kind: OwnerReferenceWorkbenchLocalStudyFailureKind) {
    super(kind);
    this.name = "OwnerReferenceWorkbenchLocalStudyError";
    this.kind = kind;
  }
}

export type OwnerReferenceWorkbenchLocalStudyRequest = Readonly<{
  snapshotRef: OwnerReferenceWorkbenchSnapshot["snapshotRef"];
  cardRef: OwnerReferenceWorkbenchCard["cardRef"];
  purpose: string;
}>;
export type OwnerReferenceWorkbenchLocalStudyResult = Readonly<{
  blob: Blob;
  workbenchRefresh: "current" | "failed";
  mediaType:
    | "application/pdf"
    | "image/bmp"
    | "image/gif"
    | "image/jpeg"
    | "image/png"
    | "image/tiff"
    | "image/webp";
}>;
export type OwnerReferenceWorkbenchLocalStudy = (
  request: OwnerReferenceWorkbenchLocalStudyRequest
) => Promise<OwnerReferenceWorkbenchLocalStudyResult>;

type LocalStudyPreview = Readonly<{
  dialog: HTMLDialogElement;
  objectUrl: string;
  close: () => void;
}>;

const localStudyPreviews = new WeakMap<Document, LocalStudyPreview>();

export function renderOwnerReferenceWorkbench(
  container: HTMLElement,
  input: unknown,
  upload?: OwnerReferenceWorkbenchUpload,
  reviewLocalOperation?: OwnerReferenceWorkbenchLocalReview,
  recoverUploadRetryState?: OwnerReferenceWorkbenchUploadRecovery,
  studyLocalReference?: OwnerReferenceWorkbenchLocalStudy
): OwnerReferenceWorkbenchSnapshot {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const snapshot = decodeSnapshot(input);
  const root = container.ownerDocument.createElement("div");
  root.className = "owner-reference-library-workbench";

  append(root, "h3", "Owner Reference Library");
  append(
    root,
    "p",
    "Owner-private · staging only. Visibility here grants no historical, specialist, provider, fixture, export, or redistribution authority.",
    "owner-reference-library-boundary"
  );
  append(
    root,
    "p",
    `${snapshot.references.length} private reference${snapshot.references.length === 1 ? "" : "s"} · ${snapshot.references.filter(({ origin }) => origin === "migrated").length} migrated · ${snapshot.references.filter(({ origin }) => origin === "upload").length} controlled upload${snapshot.references.filter(({ origin }) => origin === "upload").length === 1 ? "" : "s"}`,
    "owner-reference-library-counts"
  );

  if (upload) root.append(renderUpload(container.ownerDocument, upload, recoverUploadRetryState));

  const references = container.ownerDocument.createElement("section");
  references.className = "owner-reference-library-cards";
  if (snapshot.references.length === 0) {
    append(
      references,
      "p",
      "No migrated or newly controlled Owner references are visible yet. Legacy records must be migrated; new files must use the private controlled upload above.",
      "owner-reference-library-empty"
    );
  }
  for (const card of snapshot.references)
    references.append(
      renderCard(
        container.ownerDocument,
        card,
        snapshot.snapshotRef,
        reviewLocalOperation,
        studyLocalReference
      )
    );
  root.append(references);
  container.replaceChildren(root);
  return snapshot;
}

function renderUpload(
  document: Document,
  upload: OwnerReferenceWorkbenchUpload,
  recoverUploadRetryState?: OwnerReferenceWorkbenchUploadRecovery
): HTMLElement {
  const form = document.createElement("form");
  form.className = "owner-reference-library-upload";
  const heading = document.createElement("strong");
  heading.textContent = "Add a private reference";
  const guidance = document.createElement("p");
  guidance.textContent =
    "PDF and image bytes stay in Vellum-controlled local storage. The filename is not persisted as source identity, and every nonlocal use remains denied by default.";
  const label = document.createElement("label");
  label.append("Private PDF or image");
  const file = document.createElement("input");
  file.type = "file";
  file.accept =
    "application/pdf,image/png,image/jpeg,image/tiff,image/webp,.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp";
  file.required = true;
  label.append(file);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Add to Owner Reference Library";
  const status = document.createElement("p");
  status.className = "owner-reference-library-upload-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const recovery = renderUploadRecovery(document, status, recoverUploadRetryState);
  form.append(heading, guidance, label, submit, status, recovery);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = file.files?.[0];
    if (!selected) {
      status.textContent = "Choose one supported private PDF or image.";
      return;
    }
    submit.disabled = true;
    file.disabled = true;
    status.textContent = "Adding the private reference to controlled local storage…";
    void upload(selected)
      .then(() => {
        form.reset();
        recovery.hidden = true;
        status.textContent =
          "Private reference added. Its identity remains unresolved and nonlocal uses remain denied.";
      })
      .catch((error: unknown) => {
        const failure = uploadFailurePresentation(error);
        status.textContent = failure.message;
        recovery.hidden = !failure.offerRecovery || !recoverUploadRetryState;
      })
      .finally(() => {
        submit.disabled = false;
        file.disabled = false;
      });
  });
  return form;
}

function renderUploadRecovery(
  document: Document,
  uploadStatus: HTMLElement,
  recoverUploadRetryState?: OwnerReferenceWorkbenchUploadRecovery
): HTMLElement {
  const recovery = document.createElement("section");
  recovery.className = "owner-reference-library-upload-recovery";
  recovery.hidden = true;
  const warning = document.createElement("p");
  warning.textContent =
    "Recovery discards browser-local retry identities only. An upload with an uncertain outcome may already exist; selecting it again afterward can create another acquisition.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Recover private upload retry state";
  button.disabled = !recoverUploadRetryState;
  button.addEventListener("click", () => {
    if (!recoverUploadRetryState) return;
    const confirmed =
      document.defaultView?.confirm(
        "Discard all browser-local private upload retry identities? An upload with an uncertain outcome may already exist. Selecting that file again can create another acquisition. No stored private source will be deleted."
      ) ?? false;
    if (!confirmed) return;
    button.disabled = true;
    void recoverUploadRetryState()
      .then(() => {
        recovery.hidden = true;
        uploadStatus.textContent =
          "Browser-local retry identities were discarded. No stored private source was deleted. Retry only if you accept that an unconfirmed prior upload may become a separate acquisition.";
      })
      .catch(() => {
        uploadStatus.textContent =
          "Browser-local retry recovery failed. No stored private source was deleted. Check local-storage access and retry recovery.";
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  recovery.append(warning, button);
  return recovery;
}

function uploadFailurePresentation(error: unknown): {
  message: string;
  offerRecovery: boolean;
} {
  const kind =
    error instanceof OwnerReferenceWorkbenchUploadError ? error.kind : "outcome_uncertain";
  switch (kind) {
    case "invalid_file":
      return {
        message:
          "The selected file is not a supported private PDF or image, or its size is outside the 1 byte to 32 MiB limit. No file bytes were sent.",
        offerRecovery: false,
      };
    case "preflight_unavailable":
      return {
        message:
          "The private upload could not start because current staging state was unavailable. No file bytes were sent; retry when the local service is available.",
        offerRecovery: false,
      };
    case "retry_protection_unavailable":
      return {
        message:
          "The private upload could not start because browser-local retry protection is unavailable. No file bytes were sent; enable local storage in a current browser and retry.",
        offerRecovery: false,
      };
    case "retry_state_invalid":
      return {
        message:
          "The private upload could not start because browser-local retry state is invalid. No file bytes were sent. Use the recovery control only after reviewing its possible-duplicate warning.",
        offerRecovery: true,
      };
    case "pending_limit":
      return {
        message:
          "The private upload could not start because too many outcomes remain unresolved. No file bytes were sent. Retry the original files or use the recovery control after reviewing its possible-duplicate warning.",
        offerRecovery: true,
      };
    case "outcome_uncertain":
      return {
        message:
          "The private upload outcome could not be confirmed. Keep this same file selected and retry: Vellum will reuse its browser-local retry identity instead of creating another acquisition.",
        offerRecovery: false,
      };
  }
}

function renderCard(
  document: Document,
  card: OwnerReferenceWorkbenchCard,
  snapshotRef: OwnerReferenceWorkbenchSnapshot["snapshotRef"],
  reviewLocalOperation?: OwnerReferenceWorkbenchLocalReview,
  studyLocalReference?: OwnerReferenceWorkbenchLocalStudy
): HTMLElement {
  const article = document.createElement("article");
  article.className = "owner-reference-library-card";
  article.dataset.ownerReferenceCard = card.id;
  append(
    article,
    "strong",
    `${card.origin === "migrated" ? "Migrated private reference" : "New private upload"} · ${card.id}`
  );
  append(article, "p", `${card.mediaType} · ${formatBytes(card.byteLength)}`);
  if (card.migration) {
    append(
      article,
      "p",
      `Migration ${humanize(card.migration.state)} · legacy bytes ${humanize(card.migration.legacySourceState)}${card.migration.quarantineReason ? ` · ${humanize(card.migration.quarantineReason)}` : ""}. ${card.migration.explanation}`,
      "owner-reference-library-migration"
    );
  }
  append(
    article,
    "p",
    `Bibliographic identity ${humanize(card.identity.state)}. ${card.identity.explanation}`,
    "owner-reference-library-identity"
  );
  append(
    article,
    "p",
    `Rights ${humanize(card.rights.state)} · ${card.rights.assertionCount} assertion${card.rights.assertionCount === 1 ? "" : "s"}. ${card.rights.explanation}`,
    "owner-reference-library-rights"
  );
  append(
    article,
    "p",
    `Role state ${humanize(card.roleBindings.state)} · Owner Reference ${card.roleBindings.ownerReferenceCount} · Arrangement Source ${card.roleBindings.arrangementSourceCount} · Evaluation Source ${card.roleBindings.evaluationSourceCount}. ${card.roleBindings.explanation}`,
    "owner-reference-library-roles"
  );

  const access = document.createElement("details");
  access.className = "owner-reference-library-access";
  const summary = document.createElement("summary");
  summary.textContent = "Review private access defaults";
  access.append(summary);
  append(
    access,
    "p",
    "Ingestion and controlled-binding verification have already read these private bytes. This review request is metadata-only; local study or extraction will not read source content until an exact-acquisition, local-runtime, purpose-specific Access Decision allows it.",
    "owner-reference-library-review-guidance"
  );
  for (const decision of card.access) {
    const row = document.createElement("p");
    row.className = `owner-reference-library-access-${decision.status}`;
    row.textContent = `${sentenceCase(humanize(decision.operation))} · ${humanize(decision.status)}. ${decision.explanation}`;
    access.append(row);
  }
  if (reviewLocalOperation) {
    access.append(
      renderLocalReviewControls(
        document,
        card,
        snapshotRef,
        reviewLocalOperation,
        studyLocalReference
      )
    );
  }
  article.append(access);
  append(article, "p", `Policy ${card.policyRef.id}`, "owner-reference-library-policy");
  return article;
}

function renderLocalReviewControls(
  document: Document,
  card: OwnerReferenceWorkbenchCard,
  snapshotRef: OwnerReferenceWorkbenchSnapshot["snapshotRef"],
  reviewLocalOperation: OwnerReferenceWorkbenchLocalReview,
  studyLocalReference?: OwnerReferenceWorkbenchLocalStudy
): HTMLElement {
  const form = document.createElement("form");
  form.className = "owner-reference-library-local-review";
  const operationLabel = document.createElement("label");
  operationLabel.append("Local operation");
  const operation = document.createElement("select");
  operation.setAttribute("aria-label", "Local operation");
  for (const [value, label] of [
    ["owner_private_study", "Local study"],
    ["local_extraction", "Local extraction"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    operation.append(option);
  }
  operationLabel.append(operation);
  const purposeLabel = document.createElement("label");
  purposeLabel.append("Purpose for this review");
  const purpose = document.createElement("input");
  purpose.type = "text";
  purpose.required = true;
  purpose.maxLength = 512;
  purpose.value = "Review this exact private source for local study";
  purpose.setAttribute("aria-label", "Purpose for this review");
  purposeLabel.append(purpose);
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Review local processing";
  const status = document.createElement("p");
  status.className = "owner-reference-library-local-review-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const authorization = renderLocalStudyAuthorization(document, async (authorizedPurpose) => {
    if (!studyLocalReference) {
      throw new OwnerReferenceWorkbenchLocalStudyError("unavailable");
    }
    return studyLocalReference({
      snapshotRef,
      cardRef: card.cardRef,
      purpose: authorizedPurpose,
    });
  });
  form.append(operationLabel, purposeLabel, submit, status, authorization.element);

  const invalidateReview = () => {
    authorization.reset();
    status.textContent = "Review the current operation and purpose before accessing private bytes.";
  };
  operation.addEventListener("change", invalidateReview);
  purpose.addEventListener("input", invalidateReview);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const exactPurpose = purpose.value.trim();
    if (!exactPurpose) {
      status.textContent = "Describe the exact local purpose before reviewing access.";
      return;
    }
    submit.disabled = true;
    operation.disabled = true;
    purpose.disabled = true;
    authorization.reset();
    status.textContent = "Reviewing the private default without reading source bytes…";
    const reviewedOperation = operation.value as "owner_private_study" | "local_extraction";
    void reviewLocalOperation({
      schemaVersion: 1,
      snapshotRef,
      cardRef: card.cardRef,
      operation: reviewedOperation,
      purpose: exactPurpose,
    })
      .then((value) => {
        const result = Value.Decode(OwnerReferenceWorkbenchLocalOperationReviewResultSchema, value);
        if (result.operation !== reviewedOperation) {
          throw new Error("Local review operation mismatch");
        }
        status.textContent = localReviewExplanation(result);
        if (
          reviewedOperation === "owner_private_study" &&
          result.status === "review_required" &&
          result.reasonCode === "owner_private_local_review_required"
        ) {
          authorization.offer(exactPurpose);
        }
      })
      .catch(() => {
        status.textContent =
          "Local review could not be prepared. No private bytes were read; refresh the Workbench and retry.";
      })
      .finally(() => {
        submit.disabled = false;
        operation.disabled = false;
        purpose.disabled = false;
      });
  });
  return form;
}

function renderLocalStudyAuthorization(
  document: Document,
  study: (purpose: string) => Promise<OwnerReferenceWorkbenchLocalStudyResult>
): { element: HTMLElement; offer: (purpose: string) => void; reset: () => void } {
  const section = document.createElement("section");
  section.className = "owner-reference-library-local-study-authorization";
  section.hidden = true;
  const boundary = document.createElement("p");
  boundary.textContent =
    "Local study opens the exact private bytes only in this browser. It does not authorize extraction or grant bibliographic identity, historical-practice, specialist, provider, fixture, export, download, redistribution, or publication authority.";
  const label = document.createElement("label");
  label.className = "owner-reference-library-local-study-attestation";
  const attestation = document.createElement("input");
  attestation.type = "checkbox";
  attestation.setAttribute("aria-label", "Attest to local private study only");
  label.append(
    attestation,
    "I attest that I authorize byte-for-byte local private study only, within the limits above."
  );
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = "Open local private study preview";
  open.disabled = true;
  const status = document.createElement("p");
  status.className = "owner-reference-library-local-study-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section.append(boundary, label, open, status);

  let reviewedPurpose: string | undefined;
  const reset = () => {
    reviewedPurpose = undefined;
    section.hidden = true;
    attestation.checked = false;
    open.disabled = true;
    status.textContent = "";
  };
  const offer = (purpose: string) => {
    reviewedPurpose = purpose;
    section.hidden = false;
    attestation.checked = false;
    open.disabled = true;
    status.textContent =
      "Explicit Owner attestation and confirmation are required before any private bytes are read.";
  };
  attestation.addEventListener("change", () => {
    open.disabled = !attestation.checked || !reviewedPurpose;
  });
  open.addEventListener("click", () => {
    const exactPurpose = reviewedPurpose;
    if (!attestation.checked || !exactPurpose) return;
    const confirmed =
      document.defaultView?.confirm(
        "Open the exact private bytes for byte-for-byte local study only? This does not authorize extraction or grant identity, historical-practice, specialist, provider, fixture, export, download, redistribution, or publication authority."
      ) ?? false;
    if (!confirmed) {
      attestation.checked = false;
      open.disabled = true;
      status.textContent = "Local private study was cancelled. No private bytes were requested.";
      return;
    }
    open.disabled = true;
    attestation.disabled = true;
    status.textContent = "Opening the exact private bytes in a local-only preview…";
    void study(exactPurpose)
      .then((result) => {
        renderLocalStudyPreview(document, result);
        status.textContent =
          result.workbenchRefresh === "current"
            ? "Local-only private study preview opened. Extraction and every nonlocal authority remain unavailable."
            : "Local-only private study preview opened, but the Workbench could not refresh. Close the preview and refresh before another operation.";
      })
      .catch((error: unknown) => {
        status.textContent = localStudyFailureExplanation(error);
      })
      .finally(() => {
        attestation.checked = false;
        attestation.disabled = false;
        open.disabled = true;
      });
  });
  return { element: section, offer, reset };
}

function localStudyFailureExplanation(error: unknown): string {
  const kind =
    error instanceof OwnerReferenceWorkbenchLocalStudyError ? error.kind : "outcome_uncertain";
  switch (kind) {
    case "retry_protection_unavailable":
      return "Local study could not start because browser-local retry protection is unavailable. No preview was opened; enable local storage in a current browser and retry.";
    case "retry_state_invalid":
      return "Local study could not start because its browser-local retry state is invalid. No preview was opened; do not clear or rotate keys automatically.";
    case "pending_limit":
      return "Local study could not start because too many preview outcomes remain unresolved. No preview was opened; resolve an existing exact card-and-purpose retry first.";
    case "operation_key_conflict":
      return "The local-study operation key conflicts with a different server request. No preview was opened and the key was retained; reload and retry this exact card and purpose without rotating it automatically.";
    case "stale_before_commit":
      return "The reviewed snapshot changed before authorization committed. No preview was opened; Vellum refreshed and safely rebound the same operation key when possible. Review the current card and purpose before retrying.";
    case "unavailable":
      return "The exact private source is unavailable for local study. No preview was opened; extraction and nonlocal uses remain unavailable.";
    case "invalid_response":
      return "The local-study response was not a valid, protected PDF or image. No preview was opened and the retry key was retained.";
    case "outcome_uncertain":
      return "The local-study outcome could not be confirmed. No preview was opened; reload and retry this exact card and purpose to reuse its browser-local operation key.";
  }
}

function renderLocalStudyPreview(
  document: Document,
  result: OwnerReferenceWorkbenchLocalStudyResult
): void {
  const supported = new Set<OwnerReferenceWorkbenchLocalStudyResult["mediaType"]>([
    "application/pdf",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
  ]);
  if (!(result.blob instanceof Blob) || result.blob.size < 1 || !supported.has(result.mediaType)) {
    throw new OwnerReferenceWorkbenchLocalStudyError("invalid_response");
  }
  localStudyPreviews.get(document)?.close();
  const objectUrl = URL.createObjectURL(result.blob);
  const dialog = document.createElement("dialog");
  dialog.className = "owner-reference-local-study-preview";
  const heading = document.createElement("h2");
  heading.textContent = "Local private study preview";
  const boundary = document.createElement("p");
  boundary.textContent =
    "Byte-for-byte local study only. No identity, historical-practice, specialist, extraction, export, download, redistribution, or publication authority is granted.";
  if (result.workbenchRefresh === "failed") {
    boundary.textContent +=
      " The authorization succeeded, but the Workbench did not refresh; refresh it before another operation.";
  }
  const viewport = document.createElement("div");
  viewport.className = "owner-reference-local-study-viewport";
  if (result.mediaType === "application/pdf") {
    const frame = document.createElement("iframe");
    frame.src = objectUrl;
    frame.title = "Private PDF for local study";
    viewport.append(frame);
  } else {
    const image = document.createElement("img");
    image.src = objectUrl;
    image.alt = "Private source image for local study";
    viewport.append(image);
  }
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close private preview";
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    URL.revokeObjectURL(objectUrl);
    dialog.remove();
    if (localStudyPreviews.get(document)?.dialog === dialog) localStudyPreviews.delete(document);
  };
  const preview = Object.freeze({ dialog, objectUrl, close });
  localStudyPreviews.set(document, preview);
  dialog.addEventListener("close", close, { once: true });
  closeButton.addEventListener("click", () => {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else close();
  });
  dialog.append(heading, boundary, viewport, closeButton);
  document.body.append(dialog);
  try {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  } catch (error) {
    close();
    throw error;
  }
}

function localReviewExplanation(result: OwnerReferenceWorkbenchLocalOperationReviewResult): string {
  if (
    result.status === "review_required" &&
    result.reasonCode === "owner_private_local_review_required"
  ) {
    if (result.operation === "local_extraction") {
      return "Review required · no private bytes were read. Local extraction remains unavailable until a separately governed extraction workflow can record its inputs, transformations, evidence, and authority boundaries.";
    }
    return "Review required · no private bytes were read. Next step: record an exact Owner Access Decision for this acquisition, local runtime, operation, and purpose. Historical and specialist authority remain unasserted.";
  }
  if (result.reasonCode === "workbench_snapshot_stale") {
    return "The private reference changed while it was being reviewed. No bytes were read; refresh the Workbench and review the current version.";
  }
  if (result.reasonCode === "workbench_card_not_found_or_mismatched") {
    return "This private reference is no longer in the reviewed snapshot. No bytes were read; refresh and choose the current reference.";
  }
  return "Local processing remains denied because the current private staging snapshot could not be verified. No bytes were read.";
}

function decodeSnapshot(input: unknown): OwnerReferenceWorkbenchSnapshot {
  const snapshot = Value.Decode(OwnerReferenceWorkbenchSnapshotSchema, input);
  const cardIds = new Set<string>();
  const cardRefs = new Set<string>();
  const acquisitionIds = new Set<string>();
  for (const card of snapshot.references) {
    const cardRefKey = `${card.cardRef.id}\0${card.cardRef.digest}`;
    if (
      cardIds.has(card.id) ||
      cardRefs.has(cardRefKey) ||
      acquisitionIds.has(card.acquisitionRef.id)
    ) {
      throw new Error("Owner Reference Workbench returned duplicate private reference identity");
    }
    cardIds.add(card.id);
    cardRefs.add(cardRefKey);
    acquisitionIds.add(card.acquisitionRef.id);
    if ((card.origin === "migrated") !== (card.migration !== null)) {
      throw new Error("Owner Reference Workbench returned incoherent migration state");
    }
    const actual = new Map(card.access.map(({ operation, status }) => [operation, status]));
    if (
      actual.size !== EXPECTED_ACCESS.size ||
      [...EXPECTED_ACCESS].some(([operation, status]) => actual.get(operation) !== status)
    ) {
      throw new Error("Owner Reference Workbench returned incomplete private access defaults");
    }
  }
  return snapshot;
}

function append(
  parent: HTMLElement,
  tag: "h3" | "p" | "strong",
  text: string,
  className?: string
): HTMLElement {
  const node = parent.ownerDocument.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function sentenceCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
