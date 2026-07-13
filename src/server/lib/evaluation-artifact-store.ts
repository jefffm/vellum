import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export type EvaluationArtifactReference = {
  id: string;
  ownerRecordId: string;
  retentionClass: "ephemeral" | "ordinary" | "pinned_baseline";
  expiresAt?: string;
  baselineId?: string;
  privateWorkspaceId?: string;
  license?: string;
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
      ownerRecordId: string;
      retentionClass: EvaluationArtifactReference["retentionClass"];
      expiresAt?: string;
      baselineId?: string;
      privateWorkspaceId?: string;
      license?: string;
    }
  ): EvaluationArtifact {
    if (input.retentionClass === "pinned_baseline" && !input.baselineId) {
      throw new Error("Pinned Evaluation Artifact requires a Baseline id");
    }
    if (input.retentionClass !== "pinned_baseline" && !input.expiresAt) {
      throw new Error("Unpinned Evaluation Artifact requires an explicit retention boundary");
    }
    if (input.ownerRecordId.startsWith("fixture.") && !input.license) {
      throw new Error("Repository fixture Evaluation Artifact requires license provenance");
    }
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
    const referenceIdentity = `${input.ownerRecordId}:${input.retentionClass}:${input.baselineId ?? ""}`;
    if (
      !artifact.references.some(
        (reference) =>
          `${reference.ownerRecordId}:${reference.retentionClass}:${reference.baselineId ?? ""}` ===
          referenceIdentity
      )
    ) {
      artifact.references.push({ id: `artifact-ref.${randomUUID()}`, ...input });
    }
    this.writeManifest(manifest);
    return structuredClone(artifact);
  }

  get(id: string): EvaluationArtifact {
    const artifact = this.manifest().artifacts.find((item) => item.id === id);
    if (!artifact) throw new Error(`Evaluation Artifact not found: ${id}`);
    return structuredClone(artifact);
  }

  read(id: string): Buffer {
    const artifact = this.get(id);
    return readFileSync(path.join(this.rootDirectory, "blobs", artifact.sha256));
  }

  pinBaseline(baselineId: string, artifactIds: string[]): void {
    const manifest = this.manifest();
    for (const id of artifactIds) {
      const artifact = manifest.artifacts.find((item) => item.id === id);
      if (!artifact) throw new Error(`Cannot pin missing Evaluation Artifact: ${id}`);
      if (!artifact.references.some((reference) => reference.baselineId === baselineId)) {
        artifact.references.push({
          id: `artifact-ref.${randomUUID()}`,
          ownerRecordId: baselineId,
          retentionClass: "pinned_baseline",
          baselineId,
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

function writeFileAtomic(file: string, content: Buffer): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, file);
}
