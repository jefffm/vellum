import { Value } from "@sinclair/typebox/value";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
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

type Manifest = {
  choiceIds: string[];
  defaultCandidateIds: string[];
  defaultIds: string[];
  referenceIds: string[];
  knowledgeCandidateIds: string[];
  claimIds: string[];
  packIds: string[];
};

export class OwnerStore {
  readonly rootDirectory: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: { rootDirectory?: string; now?: () => Date; createId?: () => string } = {}) {
    this.rootDirectory =
      options.rootDirectory ?? path.join(process.env.HOME ?? process.cwd(), ".vellum", "owner");
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.initialize();
  }

  recordChoice(input: Omit<OwnerChoice, "id" | "createdAt">): {
    choice: OwnerChoice;
    candidate?: PersonalDefaultCandidate;
  } {
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
  }

  approveDefaultCandidate(id: string): PersonalDefault {
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
  }

  rejectDefaultCandidate(id: string): PersonalDefaultCandidate {
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
  }

  releaseDefault(id: string): PersonalDefault {
    const record = this.read<PersonalDefault>("defaults", id, PersonalDefaultSchema);
    return this.save<PersonalDefault>("defaults", "defaultIds", PersonalDefaultSchema, {
      ...record,
      status: "released",
      releasedAt: this.now().toISOString(),
    });
  }

  addReference(input: {
    title: string;
    citation: string;
    mimeType: string;
    contentBase64: string;
  }): OwnerReference {
    const content = Buffer.from(input.contentBase64, "base64");
    if (!content.length) throw new ApiRouteError("Owner Reference content is empty", 400);
    const sha256 = createHash("sha256").update(content).digest("hex");
    const id = `reference.${sha256.slice(0, 24)}`;
    const storedPath = path.join("references", id, "content");
    mkdirSync(path.dirname(path.join(this.rootDirectory, storedPath)), { recursive: true });
    writeFileAtomic(path.join(this.rootDirectory, storedPath), content);
    return this.save<OwnerReference>("references", "referenceIds", OwnerReferenceSchema, {
      id,
      title: input.title,
      citation: input.citation,
      mimeType: input.mimeType,
      sha256,
      storedPath,
      createdAt: this.now().toISOString(),
    });
  }

  proposeKnowledge(
    input: Omit<KnowledgeCandidate, "id" | "status" | "createdAt">
  ): KnowledgeCandidate {
    this.read("references", input.referenceId, OwnerReferenceSchema);
    return this.save<KnowledgeCandidate>(
      "knowledge-candidates",
      "knowledgeCandidateIds",
      KnowledgeCandidateSchema,
      {
        ...input,
        id: `knowledge-candidate.${this.createId()}`,
        status: "proposed",
        createdAt: this.now().toISOString(),
      }
    );
  }

  promoteKnowledge(input: {
    candidateId: string;
    packId: string;
    packName: string;
    authority: HistoricalPracticeClaim["authority"];
  }): {
    claim: HistoricalPracticeClaim;
    pack: KnowledgePack;
  } {
    const candidate = this.read<KnowledgeCandidate>(
      "knowledge-candidates",
      input.candidateId,
      KnowledgeCandidateSchema
    );
    if (candidate.status !== "proposed")
      throw new ApiRouteError(`Knowledge Candidate is already ${candidate.status}`, 409);
    const timestamp = this.now().toISOString();
    const claim = this.save<HistoricalPracticeClaim>(
      "claims",
      "claimIds",
      HistoricalPracticeClaimSchema,
      {
        id: `historical-claim.${this.createId()}`,
        statement: candidate.statement,
        scope: candidate.scope,
        authority: input.authority,
        referenceId: candidate.referenceId,
        citationLocator: candidate.citationLocator,
        sourceCandidateId: candidate.id,
        reviewedAt: timestamp,
      }
    );
    this.save<KnowledgeCandidate>(
      "knowledge-candidates",
      "knowledgeCandidateIds",
      KnowledgeCandidateSchema,
      {
        ...candidate,
        status: "promoted",
        reviewedAt: timestamp,
      }
    );
    const manifest = this.manifest();
    const existing = manifest.packIds.includes(input.packId)
      ? this.read<KnowledgePack>("packs", input.packId, KnowledgePackSchema)
      : undefined;
    const pack = this.save<KnowledgePack>("packs", "packIds", KnowledgePackSchema, {
      id: input.packId,
      name: input.packName,
      version: (existing?.version ?? 0) + 1,
      reviewed: true,
      claimIds: [...(existing?.claimIds ?? []), claim.id],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    return { claim, pack };
  }

  listChoices(): OwnerChoice[] {
    return this.list("choiceIds", "choices", OwnerChoiceSchema);
  }
  listDefaultCandidates(): PersonalDefaultCandidate[] {
    return this.list("defaultCandidateIds", "default-candidates", PersonalDefaultCandidateSchema);
  }
  listDefaults(): PersonalDefault[] {
    return this.list("defaultIds", "defaults", PersonalDefaultSchema);
  }
  listReferences(): OwnerReference[] {
    return this.list("referenceIds", "references", OwnerReferenceSchema);
  }
  listKnowledgeCandidates(): KnowledgeCandidate[] {
    return this.list("knowledgeCandidateIds", "knowledge-candidates", KnowledgeCandidateSchema);
  }
  listClaims(): HistoricalPracticeClaim[] {
    return this.list("claimIds", "claims", HistoricalPracticeClaimSchema);
  }
  listPacks(): KnowledgePack[] {
    return this.list("packIds", "packs", KnowledgePackSchema);
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
    mkdirSync(this.rootDirectory, { recursive: true });
    if (!existsSync(this.manifestPath()))
      this.writeManifest({
        choiceIds: [],
        defaultCandidateIds: [],
        defaultIds: [],
        referenceIds: [],
        knowledgeCandidateIds: [],
        claimIds: [],
        packIds: [],
      });
  }
  private manifestPath(): string {
    return path.join(this.rootDirectory, "manifest.json");
  }
  private manifest(): Manifest {
    return JSON.parse(readFileSync(this.manifestPath(), "utf8")) as Manifest;
  }
  private writeManifest(value: Manifest): void {
    writeJsonAtomic(this.manifestPath(), value);
  }
  private save<T>(category: string, key: keyof Manifest, schema: any, value: T): T {
    const decoded = Value.Decode(schema, value) as T;
    const id = (decoded as { id: string }).id;
    writeJsonAtomic(path.join(this.rootDirectory, category, `${id}.json`), decoded);
    const manifest = this.manifest();
    if (!manifest[key].includes(id)) manifest[key].push(id);
    this.writeManifest(manifest);
    return decoded;
  }
  private read<T>(category: string, id: string, schema: any): T {
    const file = path.join(this.rootDirectory, category, `${path.basename(id)}.json`);
    if (!existsSync(file)) throw new ApiRouteError(`Owner record not found: ${id}`, 404);
    return Value.Decode(schema, JSON.parse(readFileSync(file, "utf8"))) as T;
  }
  private list<T>(key: keyof Manifest, category: string, schema: any): T[] {
    return this.manifest()[key].map((id) => this.read(category, id, schema));
  }
}

function stable(value: unknown): string {
  return JSON.stringify(value, Object.keys((value as object) ?? {}).sort());
}
function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileAtomic(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
}
function writeFileAtomic(file: string, content: Buffer): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, file);
}
