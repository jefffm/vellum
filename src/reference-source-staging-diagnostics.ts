export type ReferenceSourceStagingDiagnostics = {
  publicationState: "staging_only";
  view:
    | { kind: "current" }
    | {
        kind: "historical";
        viewedSnapshotRef: { id: string; digest: string };
      };
  head: {
    snapshotId: string;
    digest: string;
    revision: number;
  } | null;
  snapshot: unknown;
  legacyProjection?: {
    ownerReferences?: unknown[];
  };
  legacyProjections?: {
    ownerReferences?: unknown[];
  };
  capabilities: {
    stagingTransactions: boolean;
    canonicalPublication: false;
  };
};

type ReferenceSourceLifecycleRef = { id: string; digest: string };

export type ReferenceSourceLifecycleDryRunRequest = {
  schemaVersion: 1;
  expectedHeadRef: ReferenceSourceLifecycleRef;
  action:
    | {
        kind: "delete_acquisition";
        targetAcquisitionRef: ReferenceSourceLifecycleRef;
        reason: string;
      }
    | {
        kind: "restrict_access";
        targetAccessDecisionRef: ReferenceSourceLifecycleRef;
        reason: string;
      };
};

export type ReferenceSourceLifecycleDryRunSubmit = (
  request: ReferenceSourceLifecycleDryRunRequest
) => Promise<unknown>;

const SAFE_TEXT_FIELDS = new Set([
  "id",
  "recordKind",
  "kind",
  "type",
  "title",
  "label",
  "name",
  "statement",
  "status",
  "state",
  "claimant",
  "basis",
  "reason",
  "rationale",
  "decision",
  "purpose",
  "destination",
  "mimeType",
  "sha256",
  "byteLength",
  "createdAt",
  "updatedAt",
  "assertedAt",
  "effectiveAt",
  "successorState",
  "conflictState",
  "revision",
]);

const NEVER_RENDER_FIELDS =
  /(?:stored|local|absolute|retrieval|download|source)?(?:path|uri|url)$|^(?:bytes|content|buffer|payload|data)$/i;

const SAFE_IDENTIFIER_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const SAFE_DIGEST_VALUE = /^[a-f0-9]{64}$/;
const UNSAFE_DIAGNOSTIC_VALUE =
  /(?:\b(?:file|https?|ftp|data|blob):(?:\/\/)?|(?:^|[\s("'=])(?:~[\\/]|\/|[A-Za-z]:[\\/]|\\\\)|\b(?:stored[_ ]?path|retrieval[_ ]?(?:uri|url)|content[_ ]?base64|evaluation[_ ]?vault[_ ]?ref)\b|\b(?:raw|private|source|binary)[\s_-]*(?:bytes|content)(?:[\s_-]*canary)?\b)/i;
const MAX_DIAGNOSTIC_TEXT_LENGTH = 500;

/**
 * Paints a compatibility view of the source graph without trusting the API to
 * have performed its own redaction. Unknown fields are omitted by default.
 */
export function renderReferenceSourceStagingDiagnostics(
  container: HTMLElement,
  input: unknown
): void {
  container.replaceChildren();
  container.classList.add("reference-source-staging-diagnostics");

  const response = parseDiagnostics(input);
  if (!response) {
    appendText(container, "p", "Staging diagnostics are not available in this build.", [
      "reference-source-staging-unavailable",
    ]);
    return;
  }

  const boundary = document.createElement("div");
  boundary.className = "reference-source-staging-boundary";
  appendText(boundary, "strong", "Staging only · read-only compatibility view");
  appendText(
    boundary,
    "p",
    response.capabilities.canonicalPublication === false
      ? "Canonical publication is disabled. These records cannot affect arranging or reviewed knowledge."
      : "Canonical publication capability was not safely identified."
  );
  container.append(boundary);

  if (response.head) {
    appendText(
      container,
      "p",
      `Current CAS head ${response.head.snapshotId} · revision ${response.head.revision} · digest ${abbreviate(response.head.digest)}`,
      ["reference-source-staging-head"]
    );
  } else {
    appendText(container, "p", "No current staging snapshot exists yet.", [
      "reference-source-staging-empty",
    ]);
  }
  if (response.view.kind === "historical") {
    appendText(
      container,
      "p",
      `Viewed historical snapshot ${response.view.viewedSnapshotRef.id} · digest ${abbreviate(response.view.viewedSnapshotRef.digest)}`,
      ["reference-source-staging-head"]
    );
  }

  renderSnapshotCollections(container, response.snapshot);
  renderLegacyProjection(
    container,
    response.legacyProjection?.ownerReferences ?? response.legacyProjections?.ownerReferences ?? []
  );
}

/**
 * Adds a noncanonical lifecycle planner only when the current snapshot contains
 * an explicit lifecycle inventory. The callback can request a sealed dry run;
 * this component deliberately has no execute, publish, or canonical action.
 */
export function renderReferenceSourceLifecycleDryRun(
  container: HTMLElement,
  input: unknown,
  submitDryRun: ReferenceSourceLifecycleDryRunSubmit
): HTMLElement | null {
  const response = parseDiagnostics(input);
  if (!response || !response.head || response.view.kind !== "current") return null;
  const inventory = lifecycleInventory(response.snapshot);
  if (!inventory || inventory.acquisitions.length === 0) return null;

  const panel = document.createElement("section");
  panel.className = "reference-source-lifecycle-planner";
  panel.dataset.referenceSourceLifecyclePlanner = "";
  appendText(panel, "h3", "Source lifecycle — sealed dry run");
  appendText(
    panel,
    "p",
    "Staging only. Preview deletion or access-restriction consequences without changing bytes, permissions, publications, or canonical records.",
    ["reference-source-lifecycle-warning"]
  );
  appendText(
    panel,
    "p",
    `Lifecycle inventory · acquisitions ${inventory.acquisitions.length} · Access Decisions ${inventory.accessDecisions.length} · storage policies ${inventory.storagePolicies} · governed uses ${inventory.uses}`,
    ["reference-source-lifecycle-inventory"]
  );

  const form = document.createElement("form");
  form.className = "reference-source-lifecycle-form";
  form.dataset.referenceSourceLifecycleForm = "";

  const actionLabel = document.createElement("label");
  actionLabel.append("Action");
  const action = document.createElement("select");
  action.name = "lifecycleAction";
  action.setAttribute("aria-label", "Action");
  action.append(new Option("Delete acquisition", "delete_acquisition"));
  if (inventory.accessDecisions.length > 0) {
    action.append(new Option("Restrict Access Decision", "restrict_access"));
  }
  actionLabel.append(action);

  const targetLabel = document.createElement("label");
  const targetLabelText = document.createElement("span");
  const target = document.createElement("select");
  target.name = "lifecycleTarget";
  target.required = true;
  targetLabel.append(targetLabelText, target);

  const reasonLabel = document.createElement("label");
  reasonLabel.append("Reason");
  const reason = document.createElement("textarea");
  reason.name = "lifecycleReason";
  reason.setAttribute("aria-label", "Reason");
  reason.required = true;
  reason.maxLength = MAX_DIAGNOSTIC_TEXT_LENGTH;
  reason.rows = 2;
  reason.placeholder = "Why should this exact acquisition or decision be changed?";
  reasonLabel.append(reason);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Preview lifecycle plan";
  const status = document.createElement("p");
  status.className = "reference-source-lifecycle-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const result = document.createElement("div");
  result.className = "reference-source-lifecycle-result";
  result.setAttribute("aria-live", "polite");
  form.append(actionLabel, targetLabel, reasonLabel, submit, status);
  panel.append(form, result);
  container.append(panel);

  const updateTargets = (): void => {
    const restricting = action.value === "restrict_access";
    const values = restricting ? inventory.accessDecisions : inventory.acquisitions;
    targetLabelText.textContent = restricting ? "Access Decision" : "Acquisition";
    target.setAttribute("aria-label", targetLabelText.textContent);
    target.replaceChildren(
      ...values.map(({ id, digest }) => {
        const option = new Option(`${id} · ${abbreviate(digest)}`, id);
        option.dataset.digest = digest;
        return option;
      })
    );
    submit.disabled = values.length === 0;
  };
  action.addEventListener("change", updateTargets);
  updateTargets();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = target.selectedOptions[0];
    const selectedRef = selected
      ? safeReference({ id: selected.value, digest: selected.dataset.digest })
      : null;
    const trimmedReason = reason.value.trim();
    if (!selectedRef || !trimmedReason) {
      status.textContent = "Choose an exact target and enter a reason for the dry run.";
      return;
    }

    const expectedHeadRef = {
      id: response.head!.snapshotId,
      digest: response.head!.digest,
    };
    const request: ReferenceSourceLifecycleDryRunRequest = {
      schemaVersion: 1,
      expectedHeadRef,
      action:
        action.value === "restrict_access"
          ? { kind: "restrict_access", targetAccessDecisionRef: selectedRef, reason: trimmedReason }
          : {
              kind: "delete_acquisition",
              targetAcquisitionRef: selectedRef,
              reason: trimmedReason,
            },
    };
    submit.disabled = true;
    action.disabled = true;
    target.disabled = true;
    reason.disabled = true;
    status.textContent = "Computing a sealed dry-run plan…";
    result.replaceChildren();

    void submitDryRun(request)
      .then((plan) => {
        const parsed = parseLifecyclePlan(plan, expectedHeadRef);
        if (!parsed) {
          status.textContent =
            "The lifecycle planner returned an unsafe or unrecognized response. Nothing changed.";
          return;
        }
        renderLifecyclePlan(result, parsed);
        status.textContent =
          parsed.status === "ready"
            ? "Dry-run plan ready. Nothing was changed."
            : "Dry-run plan blocked. Nothing was changed.";
      })
      .catch(() => {
        status.textContent =
          "Dry-run planning failed. Refresh the staging diagnostics and try again; nothing changed.";
      })
      .finally(() => {
        submit.disabled = false;
        action.disabled = false;
        target.disabled = false;
        reason.disabled = false;
        updateTargets();
      });
  });

  return panel;
}

function parseDiagnostics(input: unknown): ReferenceSourceStagingDiagnostics | null {
  if (!isRecord(input)) return null;
  if (input.publicationState !== "staging_only") return null;
  if (!isRecord(input.capabilities) || input.capabilities.canonicalPublication !== false)
    return null;
  if (!isView(input.view)) return null;
  if (input.head !== null && !isHead(input.head)) return null;
  return input as ReferenceSourceStagingDiagnostics;
}

function isView(value: unknown): value is ReferenceSourceStagingDiagnostics["view"] {
  if (!isRecord(value)) return false;
  if (value.kind === "current") return Object.keys(value).length === 1;
  return (
    value.kind === "historical" &&
    Object.keys(value).length === 2 &&
    isRecord(value.viewedSnapshotRef) &&
    Object.keys(value.viewedSnapshotRef).length === 2 &&
    typeof value.viewedSnapshotRef.id === "string" &&
    SAFE_IDENTIFIER_VALUE.test(value.viewedSnapshotRef.id) &&
    typeof value.viewedSnapshotRef.digest === "string" &&
    SAFE_DIGEST_VALUE.test(value.viewedSnapshotRef.digest)
  );
}

function isHead(value: unknown): value is NonNullable<ReferenceSourceStagingDiagnostics["head"]> {
  return (
    isRecord(value) &&
    typeof value.snapshotId === "string" &&
    SAFE_IDENTIFIER_VALUE.test(value.snapshotId) &&
    typeof value.digest === "string" &&
    SAFE_DIGEST_VALUE.test(value.digest) &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 0
  );
}

type LifecycleInventory = {
  acquisitions: ReferenceSourceLifecycleRef[];
  accessDecisions: ReferenceSourceLifecycleRef[];
  storagePolicies: number;
  uses: number;
};

function lifecycleInventory(snapshot: unknown): LifecycleInventory | null {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.records)) return null;
  const records = snapshot.records.filter(isRecord);
  const storagePolicies = records.filter(
    ({ recordKind }) => recordKind === "lifecycle_storage_policy"
  ).length;
  const uses = records.filter(({ recordKind }) => recordKind === "lifecycle_use").length;
  if (storagePolicies + uses === 0) return null;
  const references = (kind: string): ReferenceSourceLifecycleRef[] =>
    records
      .filter(({ recordKind }) => recordKind === kind)
      .map(safeReference)
      .filter((value): value is ReferenceSourceLifecycleRef => value !== null)
      .sort((left, right) => left.id.localeCompare(right.id));
  return {
    acquisitions: references("asset_acquisition"),
    accessDecisions: references("access_decision"),
    storagePolicies,
    uses,
  };
}

function safeReference(value: unknown): ReferenceSourceLifecycleRef | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !SAFE_IDENTIFIER_VALUE.test(value.id) ||
    typeof value.digest !== "string" ||
    !SAFE_DIGEST_VALUE.test(value.digest)
  ) {
    return null;
  }
  return { id: value.id, digest: value.digest };
}

type SafeLifecycleConsequence = {
  subjectRef: ReferenceSourceLifecycleRef;
  subjectKind: string;
  state: "accessible" | "restricted" | "tombstone" | "purged";
  replayability: string;
  readinessImpact: string;
  irreversibleDisclosure: boolean;
  reason?: string;
};

type SafeLifecyclePermission = {
  useId: string;
  subjectRef: ReferenceSourceLifecycleRef;
  state: "accessible" | "restricted";
  authorization: string;
  replayability: string;
  readinessImpact: string;
  sourceAvailability: string;
  reason?: string;
};

type SafeLifecycleIssue = {
  code: string;
  subjectRef?: ReferenceSourceLifecycleRef;
  detail?: string;
};

type SafeLifecyclePlan = {
  id: string;
  digest: string;
  status: "ready" | "blocked";
  consequences?: SafeLifecycleConsequence[];
  permissions?: SafeLifecyclePermission[];
  aggregate?: {
    accessible: number;
    restricted: number;
    tombstone: number;
    purged: number;
    readinessBlocked: number;
    irreversibleDisclosures: number;
  };
  issues?: SafeLifecycleIssue[];
};

const LIFECYCLE_STATES = new Set(["accessible", "restricted", "tombstone", "purged"]);
const REPLAYABILITY_STATES = new Set(["complete", "partial", "unavailable", "legacy_unverifiable"]);
const READINESS_IMPACTS = new Set(["unchanged", "advisory", "blocked"]);
const SOURCE_AVAILABILITY_STATES = new Set([
  "available",
  "partially_reproducible",
  "source_unavailable",
  "not_reproducible",
]);
const AUTHORIZATION_STATES = new Set(["direct", "provenance_substitution", "none"]);

function parseLifecyclePlan(
  input: unknown,
  expectedHeadRef: ReferenceSourceLifecycleRef
): SafeLifecyclePlan | null {
  if (!isRecord(input)) return null;
  const baseSnapshotRef = safeReference(input.baseSnapshotRef);
  if (
    input.mode !== "dry_run" ||
    input.atomicity !== "all_or_nothing" ||
    typeof input.id !== "string" ||
    !SAFE_IDENTIFIER_VALUE.test(input.id) ||
    typeof input.digest !== "string" ||
    !SAFE_DIGEST_VALUE.test(input.digest) ||
    !baseSnapshotRef ||
    baseSnapshotRef.id !== expectedHeadRef.id ||
    baseSnapshotRef.digest !== expectedHeadRef.digest ||
    (input.status !== "ready" && input.status !== "blocked")
  ) {
    return null;
  }
  const common = { id: input.id, digest: input.digest };
  if (input.status === "blocked") {
    if (!Array.isArray(input.issues) || input.issues.length === 0) return null;
    const issues = input.issues.map(parseLifecycleIssue);
    if (issues.some((issue) => issue === null)) return null;
    return { ...common, status: "blocked", issues: issues as SafeLifecycleIssue[] };
  }

  if (!Array.isArray(input.consequences) || !Array.isArray(input.permissions)) return null;
  const consequences = input.consequences.map(parseLifecycleConsequence);
  const permissions = input.permissions.map(parseLifecyclePermission);
  const aggregate = parseLifecycleAggregate(input.aggregate);
  if (
    consequences.some((consequence) => consequence === null) ||
    permissions.some((permission) => permission === null) ||
    !aggregate
  ) {
    return null;
  }
  return {
    ...common,
    status: "ready",
    consequences: consequences as SafeLifecycleConsequence[],
    permissions: permissions as SafeLifecyclePermission[],
    aggregate,
  };
}

function parseLifecycleConsequence(value: unknown): SafeLifecycleConsequence | null {
  if (!isRecord(value)) return null;
  const subjectRef = safeReference(value.subjectRef);
  const subjectKind = safeEnum(value.subjectKind);
  const state = safeEnum(value.state);
  const replayability = safeEnum(value.replayability);
  const readinessImpact = safeEnum(value.readinessImpact);
  if (
    !subjectRef ||
    !subjectKind ||
    !state ||
    !LIFECYCLE_STATES.has(state) ||
    !replayability ||
    !REPLAYABILITY_STATES.has(replayability) ||
    !readinessImpact ||
    !READINESS_IMPACTS.has(readinessImpact) ||
    typeof value.irreversibleDisclosure !== "boolean"
  ) {
    return null;
  }
  return {
    subjectRef,
    subjectKind,
    state: state as SafeLifecycleConsequence["state"],
    replayability,
    readinessImpact,
    irreversibleDisclosure: value.irreversibleDisclosure,
    reason: safeDiagnosticText(value.reason, "text"),
  };
}

function parseLifecyclePermission(value: unknown): SafeLifecyclePermission | null {
  if (!isRecord(value)) return null;
  const useId = safeDiagnosticText(value.useId, "identifier");
  const subjectRef = safeReference(value.subjectRef);
  const state = safeEnum(value.state);
  const authorization = safeEnum(value.authorization);
  const replayability = safeEnum(value.replayability);
  const readinessImpact = safeEnum(value.readinessImpact);
  const sourceAvailability = safeEnum(value.sourceAvailability);
  if (
    !useId ||
    !subjectRef ||
    (state !== "accessible" && state !== "restricted") ||
    !authorization ||
    !AUTHORIZATION_STATES.has(authorization) ||
    !replayability ||
    !REPLAYABILITY_STATES.has(replayability) ||
    !readinessImpact ||
    !READINESS_IMPACTS.has(readinessImpact) ||
    !sourceAvailability ||
    !SOURCE_AVAILABILITY_STATES.has(sourceAvailability)
  ) {
    return null;
  }
  return {
    useId,
    subjectRef,
    state,
    authorization,
    replayability,
    readinessImpact,
    sourceAvailability,
    reason: safeDiagnosticText(value.reason, "text"),
  };
}

function parseLifecycleIssue(value: unknown): SafeLifecycleIssue | null {
  if (!isRecord(value)) return null;
  const code = safeDiagnosticText(value.code, "identifier");
  const subjectRef = value.subjectRef === undefined ? undefined : safeReference(value.subjectRef);
  if (!code || subjectRef === null) return null;
  return {
    code,
    ...(subjectRef ? { subjectRef } : {}),
    detail: safeDiagnosticText(value.detail, "text"),
  };
}

function parseLifecycleAggregate(value: unknown): SafeLifecyclePlan["aggregate"] | null {
  if (!isRecord(value)) return null;
  const keys = [
    "accessible",
    "restricted",
    "tombstone",
    "purged",
    "readinessBlocked",
    "irreversibleDisclosures",
  ] as const;
  if (keys.some((key) => !Number.isInteger(value[key]) || Number(value[key]) < 0)) return null;
  return Object.fromEntries(keys.map((key) => [key, Number(value[key])])) as NonNullable<
    SafeLifecyclePlan["aggregate"]
  >;
}

function safeEnum(value: unknown): string | undefined {
  return safeDiagnosticText(value, "identifier");
}

function renderLifecyclePlan(container: HTMLElement, plan: SafeLifecyclePlan): void {
  container.replaceChildren();
  const section = document.createElement("section");
  section.className = `reference-source-lifecycle-plan reference-source-lifecycle-plan-${plan.status}`;
  appendText(
    section,
    "h4",
    `Sealed dry-run plan · ${plan.status === "ready" ? "Ready" : "Blocked"}`
  );
  appendText(
    section,
    "p",
    `${plan.id} · digest ${abbreviate(plan.digest)} · all or nothing · staging only`,
    ["reference-source-lifecycle-plan-identity"]
  );
  renderLifecycleLegend(section);

  if (plan.status === "blocked") {
    appendText(
      section,
      "p",
      "The complete inventory could not support a safe plan. No lifecycle state changed.",
      ["reference-source-lifecycle-warning"]
    );
    for (const issue of plan.issues ?? []) {
      const row = document.createElement("article");
      row.className = "reference-source-lifecycle-issue";
      appendText(row, "strong", humanize(issue.code));
      appendText(
        row,
        "p",
        [issue.subjectRef?.id, issue.detail ?? "Detail withheld by redaction policy."]
          .filter(Boolean)
          .join(" · ")
      );
      section.append(row);
    }
    container.append(section);
    return;
  }

  const aggregate = plan.aggregate!;
  appendText(
    section,
    "p",
    `Accessible ${aggregate.accessible} · Restricted ${aggregate.restricted} · Tombstone ${aggregate.tombstone} · Purged ${aggregate.purged} · readiness blocked ${aggregate.readinessBlocked} · irreversible disclosures ${aggregate.irreversibleDisclosures}`,
    ["reference-source-lifecycle-aggregate"]
  );
  renderLifecycleConsequences(section, plan.consequences ?? []);
  renderLifecyclePermissions(section, plan.permissions ?? []);
  if (aggregate.irreversibleDisclosures > 0) {
    appendText(
      section,
      "p",
      "Irreversible disclosure: Vellum cannot recall bytes already copied to an unmanaged device or external recipient.",
      ["reference-source-lifecycle-disclosure"]
    );
  }
  container.append(section);
}

function renderLifecycleLegend(container: HTMLElement): void {
  const legend = document.createElement("div");
  legend.className = "reference-source-lifecycle-legend";
  const entries = [
    ["accessible", "an exact authorized provenance path remains available"],
    ["restricted", "no applicable authorized path remains; matching bytes never transfer rights"],
    ["tombstone", "content is unavailable while minimum non-sensitive identity remains"],
    ["purged", "Vellum-controlled bytes or derivatives are removed by the proposed plan"],
  ] as const;
  for (const [state, explanation] of entries) {
    const item = document.createElement("p");
    item.className = `reference-source-lifecycle-state reference-source-lifecycle-state-${state}`;
    const label = document.createElement("strong");
    label.textContent = humanize(state);
    item.append(label, ` — ${explanation}.`);
    legend.append(item);
  }
  container.append(legend);
}

function renderLifecycleConsequences(
  container: HTMLElement,
  consequences: SafeLifecycleConsequence[]
): void {
  const group = document.createElement("section");
  group.className = "reference-source-lifecycle-consequences";
  appendText(group, "h5", "Storage and replay consequences");
  if (consequences.length === 0) appendText(group, "p", "No storage subjects are affected.");
  for (const consequence of consequences) {
    const row = document.createElement("article");
    row.className = `reference-source-lifecycle-consequence reference-source-lifecycle-state-${consequence.state}`;
    appendText(row, "strong", `${humanize(consequence.state)} · ${consequence.subjectRef.id}`);
    appendText(
      row,
      "p",
      `${humanize(consequence.subjectKind)} · replayability ${humanize(consequence.replayability)} · readiness ${humanize(consequence.readinessImpact)}`
    );
    appendText(row, "p", consequence.reason ?? "Reason withheld by redaction policy.");
    if (consequence.irreversibleDisclosure) {
      appendText(
        row,
        "p",
        "Irreversible disclosure remains recorded; external copies cannot be recalled.",
        ["reference-source-lifecycle-disclosure"]
      );
    }
    group.append(row);
  }
  container.append(group);
}

function renderLifecyclePermissions(
  container: HTMLElement,
  permissions: SafeLifecyclePermission[]
): void {
  const group = document.createElement("section");
  group.className = "reference-source-lifecycle-permissions";
  appendText(group, "h5", "Permission and use consequences");
  if (permissions.length === 0) appendText(group, "p", "No governed uses are affected.");
  for (const permission of permissions) {
    const row = document.createElement("article");
    row.className = `reference-source-lifecycle-permission reference-source-lifecycle-state-${permission.state}`;
    appendText(row, "strong", `${humanize(permission.state)} · ${permission.useId}`);
    appendText(
      row,
      "p",
      `${permission.subjectRef.id} · authorization ${humanize(permission.authorization)} · source ${humanize(permission.sourceAvailability)} · replayability ${humanize(permission.replayability)} · readiness ${humanize(permission.readinessImpact)}`
    );
    appendText(row, "p", permission.reason ?? "Reason withheld by redaction policy.");
    group.append(row);
  }
  container.append(group);
}

function renderSnapshotCollections(container: HTMLElement, snapshot: unknown): void {
  if (!isRecord(snapshot)) return;
  const collections = collectRecordCollections(snapshot);
  if (collections.length === 0) {
    appendText(container, "p", "The current snapshot contains no inspectable staged records.", [
      "reference-source-staging-empty",
    ]);
    return;
  }

  const group = document.createElement("section");
  group.className = "reference-source-staging-graph";
  appendText(group, "h3", "Staged identity and rights graph");
  const counts = collections.map(({ label, records }) => `${humanize(label)} ${records.length}`);
  appendText(group, "p", counts.join(" · "), ["reference-source-staging-counts"]);

  for (const { label, records } of collections) {
    const collection = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${humanize(label)} (${records.length})`;
    collection.append(summary);
    for (const record of records) collection.append(renderSafeRecord(record));
    group.append(collection);
  }
  container.append(group);
}

function collectRecordCollections(
  snapshot: Record<string, unknown>
): Array<{ label: string; records: Record<string, unknown>[] }> {
  const collections: Array<{ label: string; records: Record<string, unknown>[] }> = [];
  for (const [key, value] of Object.entries(snapshot)) {
    if (NEVER_RENDER_FIELDS.test(key)) continue;
    if (Array.isArray(value)) {
      const records = value.filter(isRecord);
      if (value.length === 0 || records.length === value.length) {
        collections.push(...groupRecordCollection(key, records));
      }
      continue;
    }
    if (!isRecord(value)) continue;
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (NEVER_RENDER_FIELDS.test(nestedKey) || !Array.isArray(nestedValue)) continue;
      const records = nestedValue.filter(isRecord);
      if (nestedValue.length === 0 || records.length === nestedValue.length) {
        collections.push(...groupRecordCollection(nestedKey, records));
      }
    }
  }
  return collections;
}

function groupRecordCollection(
  label: string,
  records: Record<string, unknown>[]
): Array<{ label: string; records: Record<string, unknown>[] }> {
  if (label !== "records" || records.length === 0) return [{ label, records }];
  const byKind = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const kind = typeof record.recordKind === "string" ? record.recordKind : "unclassified";
    const group = byKind.get(kind) ?? [];
    group.push(record);
    byKind.set(kind, group);
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, groupedRecords]) => ({ label: `${kind} records`, records: groupedRecords }));
}

function renderSafeRecord(record: Record<string, unknown>): HTMLElement {
  const row = document.createElement("article");
  row.className = "reference-source-staging-record";
  const title = firstSafeString(record, ["title", "label", "name", "statement", "id"]);
  appendText(row, "strong", title ?? "Unlabelled staged record");

  const facts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (NEVER_RENDER_FIELDS.test(key) || value === title) continue;
    if (key === "identityConfidence" || key === "confidence") {
      facts.push(`${humanize(key)} ${formatConfidence(value)}`);
      continue;
    }
    if (!isSafeField(key)) continue;
    const formatted = formatSafeValue(key, value);
    if (formatted !== null) facts.push(`${humanize(key)} ${formatted}`);
  }
  appendText(row, "p", facts.length > 0 ? facts.join(" · ") : "No further safe details.");
  return row;
}

function renderLegacyProjection(container: HTMLElement, records: unknown[]): void {
  const section = document.createElement("section");
  section.className = "reference-source-staging-legacy";
  appendText(section, "h3", "Legacy Owner references");
  appendText(
    section,
    "p",
    "Read-only projections preserve the legacy record without inventing a Work, edition, rights decision, or canonical binding."
  );

  const safeRecords = records.filter(isRecord);
  if (safeRecords.length === 0) {
    appendText(section, "p", "No legacy references are projected.", [
      "reference-source-staging-empty",
    ]);
  }
  for (const record of safeRecords) {
    const row = document.createElement("article");
    row.className = "reference-source-staging-record";
    appendText(row, "strong", firstSafeString(record, ["title", "id"]) ?? "Legacy reference");
    const facts = [
      safeFact("ID", record.id),
      safeFact("citation", record.citation),
      safeFact("media type", record.mimeType),
      safeFact("digest", typeof record.sha256 === "string" ? abbreviate(record.sha256) : undefined),
      safeFact("size", formatByteLength(record.byteLength)),
      `identity confidence ${formatConfidence(record.identityConfidence)}`,
    ].filter((value): value is string => Boolean(value));
    appendText(row, "p", facts.join(" · "));
    section.append(row);
  }
  container.append(section);
}

function isSafeField(key: string): boolean {
  if (NEVER_RENDER_FIELDS.test(key)) return false;
  return (
    SAFE_TEXT_FIELDS.has(key) ||
    /(?:Id|Ids|Ref|Refs|Digest|Digests|Count)$/.test(key) ||
    key === "identityConfidence" ||
    key === "confidence"
  );
}

function formatSafeValue(key: string, value: unknown): string | null {
  if (typeof value === "string") {
    if (key === "sha256" || /(?:Digest|Digests)$/.test(key)) {
      return SAFE_DIGEST_VALUE.test(value) ? abbreviate(value) : null;
    }
    const kind = /(?:^id$|Id$|Ids$|Ref$|Refs$)/.test(key) ? "identifier" : "text";
    return safeDiagnosticText(value, kind) ?? null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    const kind = /(?:Ids|Refs)$/.test(key) ? "identifier" : "text";
    const items = value.map((item) => safeDiagnosticText(item, kind));
    return items.every((item): item is string => item !== undefined) ? items.join(", ") : null;
  }
  return null;
}

export function formatReferenceIdentityConfidence(value: unknown): string {
  return formatConfidence(value);
}

function formatConfidence(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${Math.round(value * 100)}%`;
  if (!isRecord(value) || value.kind === "unknown") return "unassessed";
  if (typeof value.value === "number" && Number.isFinite(value.value)) {
    const safeBasis = safeDiagnosticText(value.basis, "text");
    const basis = safeBasis ? ` (${safeBasis})` : "";
    return `${Math.round(value.value * 100)}%${basis}`;
  }
  return "unassessed";
}

function firstSafeString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const kind = key === "id" ? "identifier" : "text";
    const value = safeDiagnosticText(record[key], kind);
    if (value) return value;
  }
  return undefined;
}

function formatByteLength(value: unknown): string | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? `${value.toLocaleString()} bytes`
    : undefined;
}

function safeFact(label: string, value: unknown): string | undefined {
  const kind = label === "ID" ? "identifier" : "text";
  const safeValue = safeDiagnosticText(value, kind);
  return safeValue ? `${label} ${safeValue}` : undefined;
}

function safeDiagnosticText(value: unknown, kind: "identifier" | "text"): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  if (value.length > MAX_DIAGNOSTIC_TEXT_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    return undefined;
  }
  if (kind === "identifier" && !SAFE_IDENTIFIER_VALUE.test(value)) return undefined;
  return UNSAFE_DIAGNOSTIC_VALUE.test(value) ? undefined : value;
}

function abbreviate(value: string): string {
  return value.length > 18 ? `${value.slice(0, 12)}…${value.slice(-6)}` : value;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
}

function appendText<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  text: string,
  classNames: string[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.classList.add(...classNames);
  element.textContent = text;
  parent.append(element);
  return element;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
