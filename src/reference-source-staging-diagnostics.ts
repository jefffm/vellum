export type ReferenceSourceStagingDiagnostics = {
  publicationState: "staging_only";
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

const SAFE_TEXT_FIELDS = new Set([
  "id",
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
      `Current snapshot ${response.head.snapshotId} · revision ${response.head.revision} · digest ${abbreviate(response.head.digest)}`,
      ["reference-source-staging-head"]
    );
  } else {
    appendText(container, "p", "No current staging snapshot exists yet.", [
      "reference-source-staging-empty",
    ]);
  }

  renderSnapshotCollections(container, response.snapshot);
  renderLegacyProjection(
    container,
    response.legacyProjection?.ownerReferences ?? response.legacyProjections?.ownerReferences ?? []
  );
}

function parseDiagnostics(input: unknown): ReferenceSourceStagingDiagnostics | null {
  if (!isRecord(input)) return null;
  if (input.publicationState !== "staging_only") return null;
  if (!isRecord(input.capabilities) || input.capabilities.canonicalPublication !== false)
    return null;
  if (input.head !== null && !isHead(input.head)) return null;
  return input as ReferenceSourceStagingDiagnostics;
}

function isHead(value: unknown): value is NonNullable<ReferenceSourceStagingDiagnostics["head"]> {
  return (
    isRecord(value) &&
    typeof value.snapshotId === "string" &&
    typeof value.digest === "string" &&
    Number.isInteger(value.revision)
  );
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
        collections.push({ label: key, records });
      }
      continue;
    }
    if (!isRecord(value)) continue;
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (NEVER_RENDER_FIELDS.test(nestedKey) || !Array.isArray(nestedValue)) continue;
      const records = nestedValue.filter(isRecord);
      if (nestedValue.length === 0 || records.length === nestedValue.length) {
        collections.push({ label: nestedKey, records });
      }
    }
  }
  return collections;
}

function renderSafeRecord(record: Record<string, unknown>): HTMLElement {
  const row = document.createElement("article");
  row.className = "reference-source-staging-record";
  const title = firstString(record, ["title", "label", "name", "statement", "id"]);
  appendText(row, "strong", title ?? "Unlabelled staged record");

  const facts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (NEVER_RENDER_FIELDS.test(key) || value === title) continue;
    if (key === "identityConfidence" || key === "confidence") {
      facts.push(`${humanize(key)} ${formatConfidence(value)}`);
      continue;
    }
    if (!isSafeField(key)) continue;
    const formatted = formatSafeValue(value);
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
    appendText(row, "strong", firstString(record, ["title", "id"]) ?? "Legacy reference");
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

function formatSafeValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(", ");
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
    const basis = typeof value.basis === "string" ? ` (${value.basis})` : "";
    return `${Math.round(value.value * 100)}%${basis}`;
  }
  return "unassessed";
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) if (typeof record[key] === "string") return record[key];
  return undefined;
}

function formatByteLength(value: unknown): string | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? `${value.toLocaleString()} bytes`
    : undefined;
}

function safeFact(label: string, value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? `${label} ${value}` : undefined;
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
