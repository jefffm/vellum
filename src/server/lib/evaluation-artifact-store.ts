import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { authorizeTrackedSourceOperation } from "../../lib/tracked-source-quarantine.js";

export type EvaluationArtifactOperation = "fixture" | "report" | "export";

export type EvaluationArtifactKind = "internal" | EvaluationArtifactOperation;

export type EvaluationArtifactRightsSource = {
  artifactId: string;
  sha256: string;
  substitutionId?: string;
};

export type EvaluationArtifactRightsRequest = {
  operation: EvaluationArtifactOperation;
  sources: EvaluationArtifactRightsSource[];
};

export type EvaluationArtifactRights = {
  operation: EvaluationArtifactOperation;
  sources: Array<
    EvaluationArtifactRightsSource & {
      resolvedArtifactId: string;
      resolvedSha256: string;
      decisionId: string;
      provenanceEvidenceRefs: string[];
    }
  >;
};

export type EvaluationArtifactReference = {
  id: string;
  artifactKind: EvaluationArtifactKind;
  ownerRecordId: string;
  retentionClass: "ephemeral" | "ordinary" | "pinned_baseline";
  expiresAt?: string;
  baselineId?: string;
  privateWorkspaceId?: string;
  license?: string;
  rights?: EvaluationArtifactRights;
};

export type EvaluationArtifact = {
  id: string;
  sha256: string;
  mediaType: string;
  byteLength: number;
  references: EvaluationArtifactReference[];
  createdAt: string;
};

type Manifest = { artifacts: EvaluationArtifact[] };

export class EvaluationArtifactStore {
  constructor(
    readonly rootDirectory: string,
    private readonly now: () => Date = () => new Date()
  ) {
    mkdirSync(path.join(rootDirectory, "blobs"), { recursive: true, mode: 0o700 });
    if (!existsSync(this.manifestPath())) this.writeManifest({ artifacts: [] });
  }

  put(
    content: Buffer,
    input: {
      mediaType: string;
      artifactKind: EvaluationArtifactKind;
      ownerRecordId: string;
      retentionClass: EvaluationArtifactReference["retentionClass"];
      expiresAt?: string;
      baselineId?: string;
      privateWorkspaceId?: string;
      license?: string;
      rights?: EvaluationArtifactRightsRequest;
    }
  ): EvaluationArtifact {
    if (input.retentionClass === "pinned_baseline" && !input.baselineId) {
      throw new Error("Pinned Evaluation Artifact requires a Baseline id");
    }
    if (input.retentionClass !== "pinned_baseline" && !input.expiresAt) {
      throw new Error("Unpinned Evaluation Artifact requires an explicit retention boundary");
    }
    const rightsRequest = validateRightsRequest(input.rights, input.artifactKind);
    const rights = rightsRequest
      ? {
          operation: rightsRequest.operation,
          sources: rightsRequest.sources.map(
            ({ artifactId, sha256: sourceSha256, substitutionId }) => {
              const resolution = authorizeTrackedSourceOperation({
                artifactId,
                sha256: sourceSha256,
                operation: rightsRequest.operation,
                ...(substitutionId ? { substitutionId } : {}),
              });
              const resolvedSha256 = resolution.resolvedSha256 ?? resolution.artifactSha256;
              const exactRequestBinding =
                resolution.artifactId === artifactId &&
                resolution.artifactSha256 === sourceSha256 &&
                resolution.operation === rightsRequest.operation;
              const exactSubstitutionBinding = substitutionId
                ? resolution.substitutionId === substitutionId
                : !resolution.substitutionId &&
                  resolution.resolvedArtifactId === artifactId &&
                  resolvedSha256 === sourceSha256;
              if (
                resolution.outcome !== "allow" ||
                !resolution.decisionId ||
                !resolution.resolvedArtifactId ||
                !resolution.resolvedSha256 ||
                resolution.provenanceEvidenceRefs.length === 0 ||
                !exactRequestBinding ||
                !exactSubstitutionBinding
              ) {
                const reason =
                  resolution.outcome !== "allow"
                    ? resolution.outcome
                    : "incomplete or mismatched allow decision";
                throw new Error(
                  `Tracked source ${artifactId} is not authorized for ${rightsRequest.operation}: ${reason}`
                );
              }
              return {
                artifactId,
                sha256: sourceSha256,
                ...(substitutionId ? { substitutionId } : {}),
                resolvedArtifactId: resolution.resolvedArtifactId,
                resolvedSha256: resolution.resolvedSha256,
                decisionId: resolution.decisionId,
                provenanceEvidenceRefs: [...resolution.provenanceEvidenceRefs],
              };
            }
          ),
        }
      : undefined;
    const sha256 = createHash("sha256").update(content).digest("hex");
    const id = `evaluation-artifact.${sha256}`;
    const manifest = this.manifest();
    let artifact = manifest.artifacts.find((item) => item.id === id);
    if (!artifact) {
      writeFileAtomic(path.join(this.rootDirectory, "blobs", sha256), content);
      artifact = {
        id,
        sha256,
        mediaType: input.mediaType,
        byteLength: content.byteLength,
        references: [],
        createdAt: this.now().toISOString(),
      };
      manifest.artifacts.push(artifact);
    } else if (
      artifact.mediaType !== input.mediaType ||
      artifact.byteLength !== content.byteLength
    ) {
      throw new Error("Content-addressed artifact metadata conflicts with existing bytes");
    }
    const { mediaType: _mediaType, rights: _rightsRequest, ...referenceInput } = input;
    const normalizedInput: Omit<EvaluationArtifactReference, "id"> = {
      ...referenceInput,
      ...(rights ? { rights } : {}),
    };
    const referenceIdentity = referenceKey(normalizedInput);
    if (!artifact.references.some((reference) => referenceKey(reference) === referenceIdentity)) {
      artifact.references.push({ id: `artifact-ref.${randomUUID()}`, ...normalizedInput });
    }
    this.writeManifest(manifest);
    return structuredClone(artifact);
  }

  get(id: string): EvaluationArtifact {
    const artifact = this.manifest().artifacts.find((item) => item.id === id);
    if (!artifact) throw new Error(`Evaluation Artifact not found: ${id}`);
    return structuredClone(artifact);
  }

  readInternal(id: string): Buffer {
    const artifact = this.get(id);
    if (
      !artifact.references.some(
        (reference) => reference.artifactKind === "internal" && !reference.rights
      )
    ) {
      throw new Error(`Evaluation Artifact is not authorized for internal read: ${id}`);
    }
    return this.readBlob(artifact);
  }

  readForOperation(id: string, operation: EvaluationArtifactOperation): Buffer {
    const artifact = this.get(id);
    const authorized = artifact.references.some(
      (reference) =>
        reference.artifactKind === operation &&
        reference.rights?.operation === operation &&
        reference.rights.sources.length > 0 &&
        reference.rights.sources.every((source) =>
          persistedRightsRemainAuthorized(source, operation)
        )
    );
    if (!authorized) {
      throw new Error(`Evaluation Artifact is not authorized for ${operation} read: ${id}`);
    }
    return this.readBlob(artifact);
  }

  pinBaseline(baselineId: string, artifactIds: string[]): void {
    const manifest = this.manifest();
    for (const id of artifactIds) {
      const artifact = manifest.artifacts.find((item) => item.id === id);
      if (!artifact) throw new Error(`Cannot pin missing Evaluation Artifact: ${id}`);
      if (!artifact.references.some((reference) => reference.baselineId === baselineId)) {
        const existingReference = artifact.references[0];
        if (!existingReference) {
          throw new Error(`Cannot pin Evaluation Artifact without an authorized reference: ${id}`);
        }
        artifact.references.push({
          id: `artifact-ref.${randomUUID()}`,
          artifactKind: existingReference.artifactKind,
          ownerRecordId: baselineId,
          retentionClass: "pinned_baseline",
          baselineId,
          ...(existingReference.rights
            ? { rights: structuredClone(existingReference.rights) }
            : {}),
        });
      }
    }
    this.writeManifest(manifest);
  }

  invalidateBaseline(baselineId: string): void {
    const manifest = this.manifest();
    manifest.artifacts.forEach((artifact) => {
      artifact.references = artifact.references.filter(
        (reference) => reference.baselineId !== baselineId
      );
    });
    this.writeManifest(manifest);
  }

  deletePrivateWorkspace(workspaceId: string): string[] {
    const manifest = this.manifest();
    const removed: string[] = [];
    manifest.artifacts = manifest.artifacts.filter((artifact) => {
      const privateLinked = artifact.references.some(
        (reference) => reference.privateWorkspaceId === workspaceId
      );
      if (!privateLinked) return true;
      rmSync(path.join(this.rootDirectory, "blobs", artifact.sha256), { force: true });
      removed.push(artifact.id);
      return false;
    });
    this.writeManifest(manifest);
    return removed;
  }

  collect(now = this.now()): string[] {
    const manifest = this.manifest();
    const removed: string[] = [];
    manifest.artifacts = manifest.artifacts.filter((artifact) => {
      artifact.references = artifact.references.filter((reference) => {
        if (reference.retentionClass === "pinned_baseline") return true;
        return !reference.expiresAt || new Date(reference.expiresAt) > now;
      });
      if (artifact.references.length > 0) return true;
      rmSync(path.join(this.rootDirectory, "blobs", artifact.sha256), { force: true });
      removed.push(artifact.id);
      return false;
    });
    this.writeManifest(manifest);
    return removed;
  }

  private manifestPath(): string {
    return path.join(this.rootDirectory, "manifest.json");
  }

  private readBlob(artifact: EvaluationArtifact): Buffer {
    return readFileSync(path.join(this.rootDirectory, "blobs", artifact.sha256));
  }

  private manifest(): Manifest {
    return JSON.parse(readFileSync(this.manifestPath(), "utf8")) as Manifest;
  }

  private writeManifest(manifest: Manifest): void {
    writeFileAtomic(
      this.manifestPath(),
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
    );
  }
}

function validateRightsRequest(
  rights: EvaluationArtifactRightsRequest | undefined,
  artifactKind: EvaluationArtifactKind
): EvaluationArtifactRightsRequest | undefined {
  if (!(["internal", "fixture", "report", "export"] as string[]).includes(artifactKind)) {
    throw new Error(`Unknown Evaluation Artifact kind: ${String(artifactKind)}`);
  }
  if (artifactKind === "internal") {
    if (rights) {
      throw new Error("Internal Evaluation Artifact cannot carry tracked-source rights");
    }
    return undefined;
  }
  if (!rights) {
    throw new Error(
      `${artifactKind} Evaluation Artifact requires an explicit operation-scoped rights decision`
    );
  }
  if (rights.operation !== artifactKind) {
    throw new Error(
      `${artifactKind} Evaluation Artifact cannot use a ${rights.operation} rights decision`
    );
  }
  const sources = [...rights.sources]
    .sort((left, right) =>
      [left.artifactId, left.sha256, left.substitutionId ?? ""]
        .join("\0")
        .localeCompare([right.artifactId, right.sha256, right.substitutionId ?? ""].join("\0"))
    )
    .filter(
      (source, index, all) =>
        index === 0 ||
        source.artifactId !== all[index - 1]!.artifactId ||
        source.sha256 !== all[index - 1]!.sha256 ||
        source.substitutionId !== all[index - 1]!.substitutionId
    );
  if (
    sources.length === 0 ||
    sources.some(
      ({ artifactId, sha256, substitutionId }) =>
        !artifactId.trim() ||
        !/^[a-f0-9]{64}$/.test(sha256) ||
        (substitutionId !== undefined && !substitutionId.trim())
    )
  ) {
    throw new Error(`${rights.operation} Evaluation Artifact requires exact tracked source refs`);
  }
  const bindingByArtifactId = new Map<string, string>();
  for (const source of sources) {
    const binding = `${source.sha256}~${source.substitutionId ?? ""}`;
    const existing = bindingByArtifactId.get(source.artifactId);
    if (existing && existing !== binding) {
      throw new Error(
        `Tracked source ${source.artifactId} has conflicting byte or substitution identities`
      );
    }
    bindingByArtifactId.set(source.artifactId, binding);
  }
  return { operation: rights.operation, sources };
}

function persistedRightsRemainAuthorized(
  source: EvaluationArtifactRights["sources"][number],
  operation: EvaluationArtifactOperation
): boolean {
  if (
    !source.artifactId ||
    !/^[a-f0-9]{64}$/.test(source.sha256) ||
    !source.resolvedArtifactId ||
    !/^[a-f0-9]{64}$/.test(source.resolvedSha256) ||
    !source.decisionId ||
    source.provenanceEvidenceRefs.length === 0
  ) {
    return false;
  }
  const resolution = authorizeTrackedSourceOperation({
    artifactId: source.artifactId,
    sha256: source.sha256,
    operation,
    ...(source.substitutionId ? { substitutionId: source.substitutionId } : {}),
  });
  return (
    resolution.outcome === "allow" &&
    resolution.artifactId === source.artifactId &&
    resolution.artifactSha256 === source.sha256 &&
    resolution.operation === operation &&
    resolution.resolvedArtifactId === source.resolvedArtifactId &&
    resolution.resolvedSha256 === source.resolvedSha256 &&
    resolution.decisionId === source.decisionId &&
    resolution.substitutionId === source.substitutionId &&
    resolution.provenanceEvidenceRefs.length > 0
  );
}

function referenceKey(
  reference: Pick<
    EvaluationArtifactReference,
    "artifactKind" | "ownerRecordId" | "retentionClass" | "baselineId" | "rights"
  >
): string {
  return [
    reference.artifactKind,
    reference.ownerRecordId,
    reference.retentionClass,
    reference.baselineId ?? "",
    reference.rights?.operation ?? "",
    reference.rights?.sources
      .map(
        ({ artifactId, sha256, substitutionId, resolvedArtifactId, resolvedSha256, decisionId }) =>
          `${artifactId}@${sha256}~${substitutionId ?? ""}->${resolvedArtifactId}@${resolvedSha256}#${decisionId}`
      )
      .join(",") ?? "",
  ].join(":");
}

function writeFileAtomic(file: string, content: Buffer): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, file);
}
