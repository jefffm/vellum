import { Value } from "@sinclair/typebox/value";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  HistoricalPracticeClaimSchema,
  KnowledgeCandidateSchema,
  KnowledgePackSchema,
  OwnerChoiceSchema,
  OwnerReferenceSchema,
  PersonalDefaultCandidateSchema,
  PersonalDefaultSchema,
} from "../../lib/owner-domain.js";
import type {
  HistoricalPracticeClaim,
  KnowledgeCandidate,
  KnowledgePack,
  OwnerChoice,
  OwnerReference,
  PersonalDefault,
  PersonalDefaultCandidate,
} from "../../lib/owner-domain.js";
import type { TargetConfiguration } from "../../lib/music-domain.js";
import { ApiRouteError } from "./create-route.js";
import { OwnerReferenceWriteClaim } from "./owner-reference-claim.js";

type OwnerStoreManifest = {
  choiceIds: string[];
  defaultCandidateIds: string[];
  defaultIds: string[];
  referenceIds: string[];
  knowledgeCandidateIds: string[];
  claimIds: string[];
  packIds: string[];
};

const LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID = "authority.cache.owner-legacy-knowledge";

export type QuarantinedLegacyKnowledgeInspection = {
  authorityPathId: typeof LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID;
  state: "quarantined";
  compatibilityMode: "quarantined_inspection_only";
  activationAllowed: false;
  knowledgeCandidates: KnowledgeCandidate[];
  historicalPracticeClaims: HistoricalPracticeClaim[];
  knowledgePacks: KnowledgePack[];
};

export class OwnerStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly storeWriteClaim: Pick<OwnerReferenceWriteClaim, "withClaim">;
  private storeWriteDepth = 0;

  constructor(
    options: {
      rootDirectory?: string;
      now?: () => Date;
      createId?: () => string;
      referenceWriteClaim?: Pick<OwnerReferenceWriteClaim, "withClaim">;
    } = {}
  ) {
    this.rootDirectory =
      options.rootDirectory ?? path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner");
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    ensureOwnerRootDirectory(this.rootDirectory);
    this.storeWriteClaim =
      options.referenceWriteClaim ??
      new OwnerReferenceWriteClaim({ rootDirectory: this.rootDirectory, now: this.now });
    this.initialize();
  }

  recordChoice(input: Omit<OwnerChoice, "id" | "createdAt">): {
    choice: OwnerChoice;
    candidate?: PersonalDefaultCandidate;
  } {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() => {
      const choice = this.save("choices", "choiceIds", OwnerChoiceSchema, {
        ...input,
        id: `choice.${this.createId()}`,
        createdAt: this.now().toISOString(),
      });
      const equivalent = this.listChoices().filter(
        (item) =>
          item.dimension === choice.dimension &&
          stable(item.value) === stable(choice.value) &&
          stable(item.scope) === stable(choice.scope)
      );
      const workspaces = new Set(equivalent.map((item) => item.workspaceId));
      const prior = this.listDefaultCandidates().find(
        (item) =>
          item.dimension === choice.dimension &&
          stable(item.value) === stable(choice.value) &&
          stable(item.scope) === stable(choice.scope)
      );
      if (workspaces.size < 2 || prior) return { choice };
      const candidate = this.save<PersonalDefaultCandidate>(
        "default-candidates",
        "defaultCandidateIds",
        PersonalDefaultCandidateSchema,
        {
          id: `default-candidate.${this.createId()}`,
          dimension: choice.dimension,
          value: choice.value,
          scope: choice.scope,
          evidenceChoiceIds: equivalent.map((item) => item.id),
          status: "proposed",
          createdAt: this.now().toISOString(),
        }
      );
      return { choice, candidate };
    });
  }

  approveDefaultCandidate(id: string): PersonalDefault {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() => {
      const candidate = this.read<PersonalDefaultCandidate>(
        "default-candidates",
        id,
        PersonalDefaultCandidateSchema
      );
      if (candidate.status !== "proposed")
        throw new ApiRouteError(`Default Candidate is already ${candidate.status}`, 409);
      const timestamp = this.now().toISOString();
      this.save<PersonalDefaultCandidate>(
        "default-candidates",
        "defaultCandidateIds",
        PersonalDefaultCandidateSchema,
        {
          ...candidate,
          status: "approved",
          resolvedAt: timestamp,
        }
      );
      return this.save<PersonalDefault>("defaults", "defaultIds", PersonalDefaultSchema, {
        id: `default.${this.createId()}`,
        candidateId: candidate.id,
        dimension: candidate.dimension,
        value: candidate.value,
        scope: candidate.scope,
        status: "active",
        createdAt: timestamp,
      });
    });
  }

  proposeDefaultCandidate(input: {
    dimension: string;
    value: unknown;
    scope: Record<string, string>;
    evidenceChoiceIds: string[];
  }): PersonalDefaultCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() =>
      this.save<PersonalDefaultCandidate>(
        "default-candidates",
        "defaultCandidateIds",
        PersonalDefaultCandidateSchema,
        {
          id: `default-candidate.${this.createId()}`,
          ...input,
          status: "proposed",
          createdAt: this.now().toISOString(),
        }
      )
    );
  }

  reviseDefaultCandidate(
    id: string,
    correction: { dimension: string; value: unknown; scope: Record<string, string> }
  ): PersonalDefaultCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() => {
      const original = this.read<PersonalDefaultCandidate>(
        "default-candidates",
        id,
        PersonalDefaultCandidateSchema
      );
      if (original.status !== "proposed")
        throw new ApiRouteError(`Default Candidate is already ${original.status}`, 409);
      this.rejectDefaultCandidate(id);
      return this.proposeDefaultCandidate({
        ...correction,
        evidenceChoiceIds: original.evidenceChoiceIds,
      });
    });
  }

  rejectDefaultCandidate(id: string): PersonalDefaultCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() => {
      const candidate = this.read<PersonalDefaultCandidate>(
        "default-candidates",
        id,
        PersonalDefaultCandidateSchema
      );
      return this.save<PersonalDefaultCandidate>(
        "default-candidates",
        "defaultCandidateIds",
        PersonalDefaultCandidateSchema,
        {
          ...candidate,
          status: "rejected",
          resolvedAt: this.now().toISOString(),
        }
      );
    });
  }

  releaseDefault(id: string): PersonalDefault {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.withStoreWriteClaim(() => {
      const record = this.read<PersonalDefault>("defaults", id, PersonalDefaultSchema);
      return this.save<PersonalDefault>("defaults", "defaultIds", PersonalDefaultSchema, {
        ...record,
        status: "released",
        releasedAt: this.now().toISOString(),
      });
    });
  }

  addReference(input: {
    title: string;
    citation: string;
    mimeType: string;
    contentBase64: string;
  }): OwnerReference {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.withStoreWriteClaim(() => {
      const title = input.title;
      const citation = input.citation;
      const mimeType = input.mimeType;
      const content = Buffer.from(input.contentBase64, "base64");
      if (!content.length) throw new ApiRouteError("Owner Reference content is empty", 400);
      const sha256 = createHash("sha256").update(content).digest("hex");
      const id = `reference.${sha256.slice(0, 24)}`;
      const storedPath = path.join("references", id, "content");
      const createdAt = this.now().toISOString();
      const replay = this.existingReferenceReplay({
        title,
        citation,
        mimeType,
        id,
        sha256,
        storedPath,
        content,
      });
      if (replay) return replay;
      const contentPath = path.join(this.rootDirectory, storedPath);
      ensureOwnerDirectory(this.rootDirectory, path.dirname(contentPath));
      writeFileCreateOnly(this.rootDirectory, contentPath, content);
      try {
        return this.saveReferenceCreateOnly({
          id,
          title,
          citation,
          mimeType,
          sha256,
          byteLength: content.byteLength,
          storedPath,
          authorityState: "raw_staged",
          activationAllowed: false,
          createdAt,
        });
      } catch (error) {
        if (!ownerPathEntryExists(this.referenceRecordPath(id))) {
          removeExactRegularFile(this.rootDirectory, contentPath);
        }
        throw error;
      }
    });
  }

  addReferenceFromSpool(input: {
    title: string;
    citation: string;
    mimeType: string;
    spoolPath: string;
    sha256: string;
    byteLength: number;
  }): OwnerReference {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.withStoreWriteClaim(() => {
      const title = input.title;
      const citation = input.citation;
      const mimeType = input.mimeType;
      const spoolPath = input.spoolPath;
      const byteLength = input.byteLength;
      const declaredSha256 = input.sha256;
      if (!byteLength) throw new ApiRouteError("Owner Reference content is empty", 400);
      if (!/^[a-f0-9]{64}$/.test(declaredSha256)) {
        throw new ApiRouteError("Owner Reference digest is invalid", 400);
      }
      const content = readFileSync(spoolPath);
      const verifiedSha256 = input.sha256;
      if (
        verifiedSha256 !== declaredSha256 ||
        content.byteLength !== byteLength ||
        createHash("sha256").update(content).digest("hex") !== declaredSha256
      ) {
        throw new ApiRouteError(
          "Owner Reference spool bytes changed before commit",
          409,
          "conflict"
        );
      }
      const id = `reference.${declaredSha256.slice(0, 24)}`;
      const storedPath = path.join("references", id, "content");
      const createdAt = this.now().toISOString();
      const replay = this.existingReferenceReplay({
        title,
        citation,
        mimeType,
        id,
        sha256: declaredSha256,
        storedPath,
        content,
      });
      if (replay) return replay;
      const destination = path.join(this.rootDirectory, storedPath);
      ensureOwnerDirectory(this.rootDirectory, path.dirname(destination));
      // Publish only the buffer whose digest and length were verified above.
      // Reopening the spool pathname here would create a mutation window.
      writeFileCreateOnly(this.rootDirectory, destination, content);
      try {
        return this.saveReferenceCreateOnly({
          id,
          title,
          citation,
          mimeType,
          sha256: declaredSha256,
          byteLength,
          storedPath,
          authorityState: "raw_staged",
          activationAllowed: false,
          createdAt,
        });
      } catch (error) {
        if (!ownerPathEntryExists(this.referenceRecordPath(id))) {
          removeExactRegularFile(this.rootDirectory, destination);
        }
        throw error;
      }
    });
  }

  private existingReferenceReplay(input: {
    id: string;
    title: string;
    citation: string;
    mimeType: string;
    sha256: string;
    storedPath: string;
    content: Buffer;
  }): OwnerReference | null {
    const recordPath = this.referenceRecordPath(input.id);
    const contentPath = path.join(this.rootDirectory, input.storedPath);
    const recordExists = ownerPathEntryExists(recordPath);
    const contentExists = ownerPathEntryExists(contentPath);
    if (!recordExists && !contentExists) return null;
    if (!recordExists || !contentExists) {
      throw new ApiRouteError(
        `Owner Reference ${input.id} has an incomplete immutable legacy record`,
        409,
        "conflict"
      );
    }
    const existing = this.read<OwnerReference>("references", input.id, OwnerReferenceSchema);
    const existingContent = readStableOwnerFile(
      this.rootDirectory,
      contentPath,
      "Owner Reference content"
    );
    const exactReplay =
      existing.id === input.id &&
      existing.title === input.title &&
      existing.citation === input.citation &&
      existing.mimeType === input.mimeType &&
      existing.sha256 === input.sha256 &&
      existing.byteLength === input.content.byteLength &&
      existing.storedPath === input.storedPath &&
      existingContent.equals(input.content) &&
      createHash("sha256").update(existingContent).digest("hex") === existing.sha256;
    if (!exactReplay) {
      throw new ApiRouteError(
        `Owner Reference immutable ID collision: ${input.id}`,
        409,
        "conflict"
      );
    }
    this.ensureReferenceManifestMembership(existing.id);
    return existing;
  }

  private saveReferenceCreateOnly(value: OwnerReference): OwnerReference {
    const decoded = Value.Decode(OwnerReferenceSchema, value) as OwnerReference;
    const file = this.referenceRecordPath(decoded.id);
    ensureOwnerDirectory(this.rootDirectory, path.dirname(file));
    writeFileCreateOnly(
      this.rootDirectory,
      file,
      Buffer.from(`${JSON.stringify(decoded, null, 2)}\n`)
    );
    this.ensureReferenceManifestMembership(decoded.id);
    return decoded;
  }

  private referenceRecordPath(id: string): string {
    return path.join(this.rootDirectory, "references", `${id}.json`);
  }

  private ensureReferenceManifestMembership(id: string): void {
    this.withStoreWriteClaim(() => {
      const manifest = this.manifest();
      if (manifest.referenceIds.includes(id)) return;
      manifest.referenceIds.push(id);
      this.writeManifest(manifest);
    });
  }

  private withStoreWriteClaim<T>(operation: () => T): T {
    if (this.storeWriteDepth > 0) return operation();
    return this.storeWriteClaim.withClaim(() => {
      this.storeWriteDepth += 1;
      try {
        return operation();
      } finally {
        this.storeWriteDepth -= 1;
      }
    });
  }

  proposeKnowledge(
    _input: Omit<KnowledgeCandidate, "id" | "status" | "createdAt">
  ): KnowledgeCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");
    throw legacyKnowledgeMutationError("proposal");
  }

  promoteKnowledge(_input: {
    candidateId: string;
    packId: string;
    packName: string;
    authority: HistoricalPracticeClaim["authority"];
  }): {
    claim: HistoricalPracticeClaim;
    pack: KnowledgePack;
  } {
    assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");
    throw legacyKnowledgeMutationError("promotion");
  }

  rejectKnowledge(_id: string): KnowledgeCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");
    throw legacyKnowledgeMutationError("rejection");
  }

  reviseKnowledge(
    _id: string,
    _correction: Pick<KnowledgeCandidate, "statement" | "scope" | "citationLocator">
  ): KnowledgeCandidate {
    assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");
    throw legacyKnowledgeMutationError("correction");
  }

  releaseClaim(_id: string): HistoricalPracticeClaim {
    assertAuthorityPathRuntime("authority.cache.owner-legacy-knowledge", "inspection");
    throw legacyKnowledgeMutationError("claim release");
  }

  listChoices(): OwnerChoice[] {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.list("choiceIds", "choices", OwnerChoiceSchema);
  }
  listDefaultCandidates(): PersonalDefaultCandidate[] {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.list("defaultCandidateIds", "default-candidates", PersonalDefaultCandidateSchema);
  }
  listDefaults(): PersonalDefault[] {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
    return this.list("defaultIds", "defaults", PersonalDefaultSchema);
  }
  listReferences(): OwnerReference[] {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.list("referenceIds", "references", OwnerReferenceSchema);
  }
  listKnowledgeCandidates(): KnowledgeCandidate[] {
    assertAuthorityPathRuntime(LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID, "inspection");
    return this.list("knowledgeCandidateIds", "knowledge-candidates", KnowledgeCandidateSchema);
  }
  listClaims(): HistoricalPracticeClaim[] {
    assertAuthorityPathRuntime(LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID, "inspection");
    return this.list("claimIds", "claims", HistoricalPracticeClaimSchema);
  }
  listPacks(): KnowledgePack[] {
    assertAuthorityPathRuntime(LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID, "inspection");
    return this.list("packIds", "packs", KnowledgePackSchema);
  }

  inspectQuarantinedLegacyKnowledge(): QuarantinedLegacyKnowledgeInspection {
    assertAuthorityPathRuntime(LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID, "inspection");
    return {
      authorityPathId: LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID,
      state: "quarantined",
      compatibilityMode: "quarantined_inspection_only",
      activationAllowed: false,
      knowledgeCandidates: this.list(
        "knowledgeCandidateIds",
        "knowledge-candidates",
        KnowledgeCandidateSchema
      ),
      historicalPracticeClaims: this.list("claimIds", "claims", HistoricalPracticeClaimSchema),
      knowledgePacks: this.list("packIds", "packs", KnowledgePackSchema),
    };
  }

  applyDefaults(target: TargetConfiguration): {
    target: TargetConfiguration;
    applications: Array<{
      defaultId: string;
      targetConfigurationId: string;
      status: "applied" | "yielded";
      reason: string;
    }>;
  } {
    assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");

    let resolved = { ...target };
    const applications = this.listDefaults()
      .filter((record) => record.status === "active")
      .filter(
        (record) => !record.scope.instrument || record.scope.instrument === target.instrumentId
      )
      .map((record) => {
        const field =
          record.dimension === "tuning"
            ? "tuningId"
            : record.dimension === "stringing"
              ? "stringing"
              : undefined;
        if (!field) {
          return {
            defaultId: record.id,
            targetConfigurationId: target.id,
            status: "yielded" as const,
            reason: `The required explicit Target Configuration takes precedence over ${record.dimension}.`,
          };
        }
        if (resolved[field] !== undefined) {
          return {
            defaultId: record.id,
            targetConfigurationId: target.id,
            status: "yielded" as const,
            reason: `The explicit Target Configuration ${field} takes precedence.`,
          };
        }
        resolved = { ...resolved, [field]: record.value } as TargetConfiguration;
        return {
          defaultId: record.id,
          targetConfigurationId: target.id,
          status: "applied" as const,
          reason:
            "Applied as a soft Owner preference because no higher-precedence choice supplied this dimension.",
        };
      });
    return { target: resolved, applications };
  }

  private initialize(): void {
    ensureOwnerRootDirectory(this.rootDirectory);
    if (ownerPathEntryExists(this.manifestPath())) {
      this.manifest();
      return;
    }
    this.withStoreWriteClaim(() => {
      if (!ownerPathEntryExists(this.manifestPath())) {
        this.writeManifest({
          choiceIds: [],
          defaultCandidateIds: [],
          defaultIds: [],
          referenceIds: [],
          knowledgeCandidateIds: [],
          claimIds: [],
          packIds: [],
        });
      } else {
        this.manifest();
      }
    });
  }
  private manifestPath(): string {
    return path.join(this.rootDirectory, "manifest.json");
  }
  private manifest(): OwnerStoreManifest {
    return JSON.parse(
      readStableOwnerFile(this.rootDirectory, this.manifestPath(), "Owner manifest").toString(
        "utf8"
      )
    ) as OwnerStoreManifest;
  }
  private writeManifest(value: OwnerStoreManifest): void {
    writeJsonAtomic(this.rootDirectory, this.manifestPath(), value);
  }
  private save<T>(category: string, key: keyof OwnerStoreManifest, schema: any, value: T): T {
    return this.withStoreWriteClaim(() => {
      const decoded = Value.Decode(schema, value) as T;
      const id = (decoded as { id: string }).id;
      writeJsonAtomic(
        this.rootDirectory,
        path.join(this.rootDirectory, category, `${id}.json`),
        decoded
      );
      const manifest = this.manifest();
      if (!manifest[key].includes(id)) manifest[key].push(id);
      this.writeManifest(manifest);
      return decoded;
    });
  }
  private read<T>(category: string, id: string, schema: any): T {
    const file = path.join(this.rootDirectory, category, `${path.basename(id)}.json`);
    if (!ownerPathEntryExists(file)) throw new ApiRouteError(`Owner record not found: ${id}`, 404);
    const stored = JSON.parse(
      readStableOwnerFile(this.rootDirectory, file, "Owner record").toString("utf8")
    );
    const value =
      schema === OwnerReferenceSchema && stored && typeof stored === "object"
        ? {
            ...stored,
            authorityState: "raw_staged",
            activationAllowed: false,
          }
        : stored;
    return Value.Decode(schema, value) as T;
  }
  private list<T>(key: keyof OwnerStoreManifest, category: string, schema: any): T[] {
    return this.manifest()[key].map((id) => this.read(category, id, schema));
  }
}

function legacyKnowledgeMutationError(operation: string): ApiRouteError {
  return new ApiRouteError(
    `Legacy Owner knowledge ${operation} is unavailable because this compatibility path is quarantined for inspection only`,
    410,
    "conflict",
    {
      reason: "legacy_knowledge_quarantined",
      authorityPathId: LEGACY_KNOWLEDGE_AUTHORITY_PATH_ID,
      compatibilityMode: "quarantined_inspection_only",
      activationAllowed: false,
    }
  );
}

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys((value as object) ?? {}).sort());
}
function writeJsonAtomic(root: string, file: string, value: unknown): void {
  writeFileAtomic(root, file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
}

function writeFileAtomic(root: string, file: string, content: Buffer): void {
  const directory = path.dirname(file);
  const identities = ownerDirectoryIdentities(root, directory, true);
  const temporary = path.join(directory, `.pending.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
      0o600
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    assertOwnerDirectoryIdentities(identities);
    if (ownerPathEntryExists(file)) assertStableRegularOwnerPath(root, file, "Owner record");
    renameSync(temporary, file);
    if (!pathMatchesDescriptor(file, descriptor)) {
      throw ownerStorageError("Owner atomic write target changed during publication");
    }
    assertOwnerDirectoryIdentities(identities);
    fsyncDirectory(directory);
  } finally {
    if (descriptor !== undefined) {
      if (pathMatchesDescriptor(temporary, descriptor)) {
        unlinkSync(temporary);
        fsyncDirectory(directory);
      }
      closeSync(descriptor);
    }
  }
}

function writeFileCreateOnly(root: string, file: string, content: Buffer): void {
  const directory = path.dirname(file);
  const identities = ownerDirectoryIdentities(root, directory, true);
  const temporary = path.join(directory, `.pending.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  let published = false;
  let completed = false;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollowFlag(),
      0o600
    );
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    assertOwnerDirectoryIdentities(identities);
    try {
      // Publish only after the complete bytes are durable. Hard-link creation
      // is atomic and cannot replace an existing immutable reference path.
      linkSync(temporary, file);
      published = true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new ApiRouteError(
          `Owner Reference immutable path already exists: ${path.basename(file)}`,
          409,
          "conflict"
        );
      }
      throw error;
    }
    if (!pathMatchesDescriptor(file, descriptor)) {
      throw ownerStorageError("Owner Reference immutable target changed during publication");
    }
    assertOwnerDirectoryIdentities(identities);
    fsyncDirectory(directory);
    completed = true;
  } finally {
    if (descriptor !== undefined) {
      let directoryChanged = false;
      if (published && !completed && pathMatchesDescriptor(file, descriptor)) {
        unlinkSync(file);
        directoryChanged = true;
      }
      if (pathMatchesDescriptor(temporary, descriptor)) {
        unlinkSync(temporary);
        directoryChanged = true;
      }
      if (directoryChanged) fsyncDirectory(directory);
      closeSync(descriptor);
    }
  }
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(
    directory,
    fsConstants.O_RDONLY |
      noFollowFlag() |
      (typeof fsConstants.O_DIRECTORY === "number" ? fsConstants.O_DIRECTORY : 0)
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

type OwnerDirectoryIdentity = { path: string; dev: bigint; ino: bigint };

function ensureOwnerRootDirectory(root: string): void {
  if (!ownerPathEntryExists(root)) mkdirSync(root, { recursive: true, mode: 0o700 });
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw ownerStorageError("Owner root must be a real directory");
  }
  assertOwnerDirectoryAccess(stat.uid, stat.mode);
}

function ensureOwnerDirectory(root: string, directory: string): void {
  ownerDirectoryIdentities(root, directory, true);
}

function ownerDirectoryIdentities(
  root: string,
  directory: string,
  create: boolean
): OwnerDirectoryIdentity[] {
  ensureOwnerRootDirectory(root);
  const absoluteRoot = path.resolve(root);
  const absoluteDirectory = path.resolve(directory);
  if (
    absoluteDirectory !== absoluteRoot &&
    !absoluteDirectory.startsWith(`${absoluteRoot}${path.sep}`)
  ) {
    throw ownerStorageError("Owner storage path escapes its root");
  }
  const identities: OwnerDirectoryIdentity[] = [];
  let cursor = absoluteRoot;
  const components = path.relative(absoluteRoot, absoluteDirectory).split(path.sep).filter(Boolean);
  for (const component of ["", ...components]) {
    if (component) cursor = path.join(cursor, component);
    if (!ownerPathEntryExists(cursor)) {
      if (!create) throw ownerStorageError("Owner storage directory is missing");
      try {
        mkdirSync(cursor, { mode: 0o700 });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
    }
    const stat = lstatSync(cursor, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw ownerStorageError("Owner storage traverses a symlink or non-directory ancestor");
    }
    assertOwnerDirectoryAccess(stat.uid, stat.mode);
    identities.push({ path: cursor, dev: stat.dev, ino: stat.ino });
  }
  return identities;
}

function assertOwnerDirectoryIdentities(identities: OwnerDirectoryIdentity[]): void {
  for (const identity of identities) {
    const current = lstatSync(identity.path, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino
    ) {
      throw ownerStorageError("Owner storage ancestor changed during the operation");
    }
    assertOwnerDirectoryAccess(current.uid, current.mode);
  }
}

function readStableOwnerFile(root: string, file: string, label: string): Buffer {
  const identities = ownerDirectoryIdentities(root, path.dirname(file), false);
  let descriptor: number;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
  } catch (error) {
    throw ownerStorageError(`${label} could not be opened without following links`);
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || !pathMatchesDescriptor(file, descriptor)) {
      throw ownerStorageError(`${label} is not one stable regular file`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    assertOwnerDirectoryIdentities(identities);
    if (
      !after.isFile() ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !pathMatchesDescriptor(file, descriptor)
    ) {
      throw ownerStorageError(`${label} changed while it was being read`);
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function assertStableRegularOwnerPath(root: string, file: string, label: string): void {
  const descriptor = openSync(file, fsConstants.O_RDONLY | noFollowFlag());
  try {
    ownerDirectoryIdentities(root, path.dirname(file), false);
    if (!pathMatchesDescriptor(file, descriptor)) {
      throw ownerStorageError(`${label} is not one stable regular file`);
    }
  } finally {
    closeSync(descriptor);
  }
}

function removeExactRegularFile(root: string, file: string): void {
  if (!ownerPathEntryExists(file)) return;
  assertStableRegularOwnerPath(root, file, "Owner cleanup target");
  unlinkSync(file);
  fsyncDirectory(path.dirname(file));
}

function pathMatchesDescriptor(file: string, descriptor: number): boolean {
  try {
    const opened = fstatSync(descriptor);
    const named = lstatSync(file);
    return (
      opened.isFile() &&
      named.isFile() &&
      !named.isSymbolicLink() &&
      opened.dev === named.dev &&
      opened.ino === named.ino
    );
  } catch {
    return false;
  }
}

function ownerPathEntryExists(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function noFollowFlag(): number {
  return typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0;
}

function assertOwnerDirectoryAccess(uid: number | bigint, mode: number | bigint): void {
  const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : null;
  if (effectiveUid !== null && BigInt(uid) !== BigInt(effectiveUid)) {
    throw ownerStorageError("Owner storage directory is not owned by the current OS user");
  }
  if ((BigInt(mode) & BigInt(0o022)) !== BigInt(0)) {
    throw ownerStorageError("Owner storage directory is writable outside the Owner OS user");
  }
}

function ownerStorageError(message: string): ApiRouteError {
  return new ApiRouteError(message, 409, "conflict");
}
