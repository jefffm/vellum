import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const SHA256 = /^[a-f0-9]{64}$/;

const RECORD_KINDS = new Set([
  "knowledge_applicability_predicate",
  "knowledge_candidate",
  "knowledge_evidence_edge",
  "knowledge_constraint_derivation",
  "knowledge_component_binding",
  "knowledge_component_mapping",
  "knowledge_profile",
  "knowledge_pack_draft",
  "knowledge_pack_release",
  "knowledge_system_identity_snapshot",
  "knowledge_test_policy",
  "reviewer_authority_scope",
  "reviewer_identity_snapshot",
  "reviewer_credential_assertion",
  "reviewer_trust_policy",
  "reviewer_revocation_snapshot",
  "reviewer_verifier_receipt",
  "release_attestation",
  "release_advisory",
  "attestation_verification",
  "advisory_verification",
  "identity_verification",
  "authority_verification",
  "activation_decision",
  "knowledge_library_inventory_snapshot",
  "knowledge_catalog_snapshot",
  "knowledge_resolution_context",
  "knowledge_resolution_policy",
  "knowledge_inventory_outcome",
  "knowledge_predicate_result",
  "knowledge_component_registry_snapshot",
  "knowledge_provisional_consequence",
  "applied_knowledge_manifest",
  "owner_reference_migration_mapping",
  "owner_reference_migration_quarantine",
  "owner_reference_migration_journal",
]);
const WRITER_KINDS = new Set(["upload", "review", "advisory", "activation", "system", "migration"]);
const ORPHAN_STATES = new Set(["incomplete_staging", "complete_staging", "complete_generation"]);
const PRIVATE_COUNT_LIMIT = 999;

export type KnowledgePublicationRecordRef = {
  id: string;
  digest: string;
  recordKind: string;
};

export type KnowledgePublicationRecord = KnowledgePublicationRecordRef & {
  schemaVersion: 1;
  successorRefs: KnowledgePublicationRecordRef[];
};

export type KnowledgePublicationGenerationRef = {
  id: string;
  digest: string;
  revision: number;
};

export type KnowledgePublicationGeneration = KnowledgePublicationGenerationRef & {
  schemaVersion: 1;
  parentGenerationRef?: KnowledgePublicationGenerationRef;
  transactionId: string;
  writerKind: string;
  createdAt: string;
  requestDigest: string;
  recordRefs: KnowledgePublicationRecordRef[];
  newRecordRefs: KnowledgePublicationRecordRef[];
};

export type KnowledgePublicationHead = {
  generationId: string;
  digest: string;
  revision: number;
};

export type KnowledgePublicationSnapshot = {
  head: KnowledgePublicationHead;
  generation: KnowledgePublicationGeneration;
  records: KnowledgePublicationRecord[];
};

export type KnowledgePublicationOrphan = {
  generationId: string;
  displayRef: {
    id: string;
    digest: string;
  };
  state: string;
  transactionId: string | null;
  revision: number | null;
  parentGenerationRef: KnowledgePublicationGenerationRef | null;
  stagedRecordCount: number;
};

export type KnowledgePublicationWorkbenchState = {
  current: KnowledgePublicationSnapshot | null;
  orphans: KnowledgePublicationOrphan[];
};

export function renderKnowledgePublicationWorkbench(
  container: HTMLElement,
  value: unknown,
  reclaim?: (generationId: string) => Promise<unknown>
): KnowledgePublicationWorkbenchState {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");

  const state = decodeWorkbenchState(value);
  const root = container.ownerDocument.createElement("div");
  root.className = "knowledge-publication-workbench";

  const heading = container.ownerDocument.createElement("h3");
  heading.textContent = "Transactional publication generations";
  const boundary = container.ownerDocument.createElement("p");
  boundary.className = "knowledge-publication-boundary";
  boundary.textContent =
    "One immutable generation becomes visible at a time. Drafts, releases, reviews, advisories, decisions, Inventory, and Catalog records remain unchanged after publication.";
  root.append(heading, boundary);

  if (!state.current) {
    const empty = container.ownerDocument.createElement("p");
    empty.className = "knowledge-publication-empty";
    empty.textContent = "No canonical knowledge publication generation exists yet.";
    root.append(empty);
  } else {
    root.append(renderCurrent(container.ownerDocument, state.current));
  }

  root.append(renderOrphans(container.ownerDocument, state.orphans, reclaim));
  container.replaceChildren(root);
  return state;
}

function renderCurrent(document: Document, snapshot: KnowledgePublicationSnapshot): HTMLElement {
  if (isMigrationPublication(snapshot)) return renderPrivateMigrationCurrent(document, snapshot);

  const section = document.createElement("section");
  section.className = "knowledge-publication-current";
  const generation = snapshot.generation;
  const title = document.createElement("h4");
  title.textContent = `Current generation r${generation.revision}`;
  const identity = document.createElement("p");
  identity.className = "knowledge-publication-head";
  identity.textContent = `${generation.id} · ${generation.digest}`;
  const lineage = document.createElement("p");
  lineage.className = "knowledge-publication-lineage";
  lineage.textContent = generation.parentGenerationRef
    ? `Successor of ${generation.parentGenerationRef.id} at r${generation.parentGenerationRef.revision}`
    : "Initial publication generation";
  const counts = document.createElement("p");
  counts.textContent = `${snapshot.records.length} visible immutable records · ${generation.newRecordRefs.length} introduced here · writer ${generation.writerKind}`;
  section.append(title, identity, lineage, counts);

  const records = document.createElement("details");
  records.open = true;
  const summary = document.createElement("summary");
  summary.textContent = "Visible records and successors";
  records.append(summary);
  for (const record of snapshot.records) records.append(renderRecord(document, record));
  section.append(records);
  return section;
}

function renderPrivateMigrationCurrent(
  document: Document,
  snapshot: KnowledgePublicationSnapshot
): HTMLElement {
  const section = document.createElement("section");
  section.className = "knowledge-publication-current knowledge-publication-current-private";
  const title = document.createElement("h4");
  title.textContent = "Current private migration publication";
  const boundary = document.createElement("p");
  boundary.className = "knowledge-publication-head";
  boundary.textContent =
    "Migration publication identities, digests, record identities, and successor identities are withheld.";
  const lineage = document.createElement("p");
  lineage.className = "knowledge-publication-lineage";
  lineage.textContent = snapshot.generation.parentGenerationRef
    ? "Successor publication · private lineage withheld"
    : "Initial publication · private lineage withheld";
  const counts = document.createElement("p");
  counts.textContent = `${boundedCount(snapshot.records.length)} visible immutable records · ${boundedCount(snapshot.generation.newRecordRefs.length)} introduced here · migration staging only`;
  section.append(title, boundary, lineage, counts);
  return section;
}

function renderRecord(document: Document, record: KnowledgePublicationRecord): HTMLElement {
  const row = document.createElement("article");
  row.className = "knowledge-publication-record";
  const title = document.createElement("strong");
  title.textContent = `${labelForKind(record.recordKind)} · ${record.id}`;
  const identity = document.createElement("p");
  identity.textContent = `Digest ${record.digest}`;
  row.append(title, identity);
  if (record.successorRefs.length > 0) {
    const successors = document.createElement("p");
    successors.className = "knowledge-publication-successors";
    successors.textContent = `Successor of ${record.successorRefs.map((ref) => `${labelForKind(ref.recordKind)} · ${ref.id}`).join(", ")}`;
    row.append(successors);
  }
  return row;
}

function renderOrphans(
  document: Document,
  orphans: KnowledgePublicationOrphan[],
  reclaim?: (generationId: string) => Promise<unknown>
): HTMLElement {
  const details = document.createElement("details");
  details.className = "knowledge-publication-orphans";
  const summary = document.createElement("summary");
  summary.textContent = `Recoverable unreachable generations (${boundedCount(orphans.length)})`;
  details.append(summary);
  if (orphans.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No staged or finalized orphan generations were found.";
    details.append(empty);
    return details;
  }
  for (const orphan of orphans.slice(0, PRIVATE_COUNT_LIMIT)) {
    const row = document.createElement("article");
    row.className = "knowledge-publication-orphan";
    const title = document.createElement("strong");
    title.textContent = `Unreachable private generation ${orphan.displayRef.id} · ${humanize(orphan.state)}`;
    const detail = document.createElement("p");
    detail.textContent = `${boundedCount(orphan.stagedRecordCount)} staged records · private transaction and lineage withheld`;
    row.append(title, detail);
    if (reclaim) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Reclaim unreachable generation";
      button.setAttribute("aria-label", `Reclaim ${orphan.displayRef.id}`);
      const status = document.createElement("p");
      status.className = "knowledge-publication-orphan-status";
      status.setAttribute("role", "status");
      button.addEventListener("click", () => {
        const confirmed =
          document.defaultView?.confirm(
            `Permanently reclaim ${orphan.displayRef.id}? This deletes that unreachable private staging generation and cannot be undone.`
          ) ?? false;
        if (!confirmed) return;
        button.disabled = true;
        status.textContent = `Reclaiming ${orphan.displayRef.id}…`;
        void reclaim(orphan.generationId).then(
          () => {
            status.textContent = `Reclaimed ${orphan.displayRef.id}.`;
          },
          () => {
            button.disabled = false;
            status.textContent = `Could not reclaim ${orphan.displayRef.id}. Refresh and retry.`;
          }
        );
      });
      row.append(button, status);
    }
    details.append(row);
  }
  if (orphans.length > PRIVATE_COUNT_LIMIT) {
    const withheld = document.createElement("p");
    withheld.textContent = "Additional private orphan rows are withheld from this view.";
    details.append(withheld);
  }
  return details;
}

function decodeWorkbenchState(value: unknown): KnowledgePublicationWorkbenchState {
  const input = object(value, "knowledge publication response", ["current", "orphans"]);
  const orphans = array(input.orphans, "publication orphans").map(decodeOrphan);
  const generationIds = orphans.map(({ generationId }) => generationId);
  const displayIds = orphans.map(({ displayRef }) => displayRef.id);
  if (
    new Set(generationIds).size !== generationIds.length ||
    new Set(displayIds).size !== displayIds.length
  ) {
    throw new Error("Publication orphans contain duplicate identities");
  }
  return {
    current: input.current === null ? null : decodeSnapshot(input.current),
    orphans,
  };
}

function decodeSnapshot(value: unknown): KnowledgePublicationSnapshot {
  const input = object(value, "publication snapshot", ["head", "generation", "records"]);
  const head = decodeHead(input.head);
  const generation = decodeGeneration(input.generation);
  const records = array(input.records, "publication records").map(decodeRecord);
  if (
    head.generationId !== generation.id ||
    head.digest !== generation.digest ||
    head.revision !== generation.revision
  ) {
    throw new Error("Publication head does not match the rendered immutable generation");
  }
  if (canonicalRefs(records) !== canonicalRefs(generation.recordRefs)) {
    throw new Error("Publication generation record closure does not match its rendered records");
  }
  const recordRefs = new Set(generation.recordRefs.map(refKey));
  for (const ref of generation.newRecordRefs) {
    if (!recordRefs.has(refKey(ref))) {
      throw new Error("Publication generation names a new record outside its record closure");
    }
  }
  for (const record of records) {
    for (const predecessor of record.successorRefs) {
      if (!recordRefs.has(refKey(predecessor))) {
        throw new Error("Publication successor relationship points outside its stable snapshot");
      }
    }
  }
  return { head, generation, records };
}

function decodeHead(value: unknown): KnowledgePublicationHead {
  const input = object(value, "publication head", ["generationId", "digest", "revision"]);
  return {
    generationId: id(input.generationId, "head generation ID"),
    digest: digest(input.digest, "head digest"),
    revision: revision(input.revision, "head revision"),
  };
}

function decodeGeneration(value: unknown): KnowledgePublicationGeneration {
  const input = object(
    value,
    "publication generation",
    [
      "schemaVersion",
      "id",
      "revision",
      "transactionId",
      "writerKind",
      "createdAt",
      "requestDigest",
      "recordRefs",
      "newRecordRefs",
      "digest",
    ],
    ["parentGenerationRef"]
  );
  if (input.schemaVersion !== 1) throw new Error("Unsupported publication generation schema");
  if (typeof input.writerKind !== "string" || !WRITER_KINDS.has(input.writerKind)) {
    throw new Error("Unknown publication writer kind");
  }
  if (typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error("Invalid publication generation timestamp");
  }
  return {
    schemaVersion: 1,
    id: id(input.id, "generation ID"),
    revision: revision(input.revision, "generation revision"),
    ...(input.parentGenerationRef === undefined
      ? {}
      : { parentGenerationRef: decodeGenerationRef(input.parentGenerationRef) }),
    transactionId: id(input.transactionId, "transaction ID"),
    writerKind: input.writerKind,
    createdAt: input.createdAt,
    requestDigest: digest(input.requestDigest, "request digest"),
    recordRefs: uniqueRefs(input.recordRefs, "generation record refs"),
    newRecordRefs: uniqueRefs(input.newRecordRefs, "generation new-record refs"),
    digest: digest(input.digest, "generation digest"),
  };
}

function decodeGenerationRef(value: unknown): KnowledgePublicationGenerationRef {
  const input = object(value, "publication generation ref", ["id", "digest", "revision"]);
  return {
    id: id(input.id, "generation ref ID"),
    digest: digest(input.digest, "generation ref digest"),
    revision: revision(input.revision, "generation ref revision"),
  };
}

function decodeRecord(value: unknown): KnowledgePublicationRecord {
  const input = object(value, "publication record", [
    "schemaVersion",
    "recordKind",
    "id",
    "successorRefs",
    "digest",
  ]);
  if (input.schemaVersion !== 1) throw new Error("Unsupported publication record schema");
  const ref = decodeRecordRef({
    recordKind: input.recordKind,
    id: input.id,
    digest: input.digest,
  });
  return {
    schemaVersion: 1,
    ...ref,
    successorRefs: uniqueRefs(input.successorRefs, `${ref.id} successor refs`),
  };
}

function decodeRecordRef(value: unknown): KnowledgePublicationRecordRef {
  const input = object(value, "publication record ref", ["recordKind", "id", "digest"]);
  if (typeof input.recordKind !== "string" || !RECORD_KINDS.has(input.recordKind)) {
    throw new Error("Unknown publication record kind");
  }
  return {
    recordKind: input.recordKind,
    id: id(input.id, "record ID"),
    digest: digest(input.digest, "record digest"),
  };
}

function decodeOrphan(value: unknown): KnowledgePublicationOrphan {
  const input = object(value, "publication orphan", [
    "generationId",
    "displayRef",
    "state",
    "transactionId",
    "revision",
    "parentGenerationRef",
    "stagedRecordCount",
  ]);
  if (typeof input.state !== "string" || !ORPHAN_STATES.has(input.state)) {
    throw new Error("Unknown publication orphan state");
  }
  return {
    generationId: id(input.generationId, "orphan generation ID"),
    displayRef: decodePrivateDisplayRef(input.displayRef),
    state: input.state,
    transactionId:
      input.transactionId === null ? null : id(input.transactionId, "orphan transaction ID"),
    revision: input.revision === null ? null : revision(input.revision, "orphan revision"),
    parentGenerationRef:
      input.parentGenerationRef === null ? null : decodeGenerationRef(input.parentGenerationRef),
    stagedRecordCount: revision(input.stagedRecordCount, "orphan staged-record count", true),
  };
}

function decodePrivateDisplayRef(value: unknown): KnowledgePublicationOrphan["displayRef"] {
  const input = object(value, "publication orphan display ref", ["id", "digest"]);
  return {
    id: id(input.id, "orphan display-ref ID"),
    digest: digest(input.digest, "orphan display-ref digest"),
  };
}

function uniqueRefs(value: unknown, label: string): KnowledgePublicationRecordRef[] {
  const refs = array(value, label).map(decodeRecordRef);
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) throw new Error(`${label} contains duplicates`);
  return refs;
}

function canonicalRefs(refs: KnowledgePublicationRecordRef[]): string {
  return [...refs].map(refKey).sort().join("\n");
}

function refKey(ref: KnowledgePublicationRecordRef): string {
  return `${ref.recordKind}:${ref.id}:${ref.digest}`;
}

function isMigrationPublication(snapshot: KnowledgePublicationSnapshot): boolean {
  return (
    snapshot.generation.writerKind === "migration" ||
    snapshot.records.some(({ recordKind }) => isMigrationRecordKind(recordKind))
  );
}

function isMigrationRecordKind(kind: string): boolean {
  return kind.startsWith("owner_reference_migration_");
}

function boundedCount(value: number): string {
  return value > PRIVATE_COUNT_LIMIT ? `${PRIVATE_COUNT_LIMIT}+` : String(value);
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function labelForKind(kind: string): string {
  if (kind === "knowledge_system_identity_snapshot") {
    return "System Test Metadata · Identity Snapshot (No Authority)";
  }
  if (kind === "knowledge_test_policy") {
    return "System Test Metadata · Test Policy (No Activation)";
  }
  return kind
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function object(
  value: unknown,
  label: string,
  required: string[],
  optional: string[] = []
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !(key in input)) ||
    Object.keys(input).some((key) => !allowed.has(key))
  ) {
    throw new Error(`${label} failed closed-schema validation`);
  }
  return input;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function revision(value: unknown, label: string, allowZero = false): number {
  if (!Number.isSafeInteger(value) || Number(value) < (allowZero ? 0 : 1)) {
    throw new Error(`Invalid ${label}`);
  }
  return Number(value);
}
