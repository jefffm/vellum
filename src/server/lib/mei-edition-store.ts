import { Value } from "@sinclair/typebox/value";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MeiEditionVersionSchema, type MeiEditionVersion } from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore, workspaceRootDirectory } from "./workspace-store.js";

export class MeiEditionStore {
  readonly rootDirectory: string;
  private readonly workspaces: WorkspaceStore;

  constructor(options: { rootDirectory?: string; workspaces?: WorkspaceStore } = {}) {
    this.rootDirectory = options.rootDirectory ?? workspaceRootDirectory();
    this.workspaces =
      options.workspaces ?? new WorkspaceStore({ rootDirectory: this.rootDirectory });
  }

  create(workspaceId: string, edition: MeiEditionVersion): MeiEditionVersion {
    this.assertSource(workspaceId, edition.sourceArtifactId);
    const decoded = Value.Decode(MeiEditionVersionSchema, edition);
    if (decoded.version !== 1 || decoded.parentVersion !== undefined) {
      throw new ApiRouteError("A new MEI Edition must begin at version 1", 400);
    }
    const directory = this.editionDirectory(workspaceId, decoded.editionId);
    mkdirSync(path.dirname(directory), { recursive: true });
    mkdirSync(directory, { recursive: false });
    this.writeVersion(directory, decoded);
    this.writeHead(directory, decoded.version);
    return decoded;
  }

  get(workspaceId: string, editionId: string, version?: number): MeiEditionVersion {
    this.workspaces.get(workspaceId);
    const directory = this.editionDirectory(workspaceId, editionId);
    const resolvedVersion = version ?? this.readHead(directory);
    try {
      return Value.Decode(
        MeiEditionVersionSchema,
        JSON.parse(readFileSync(this.versionPath(directory, resolvedVersion), "utf8"))
      );
    } catch (error) {
      if (error instanceof ApiRouteError) throw error;
      throw new ApiRouteError(
        `MEI Edition version not found: ${editionId} v${resolvedVersion}`,
        404
      );
    }
  }

  commit(
    workspaceId: string,
    edition: MeiEditionVersion,
    expectedVersion: number
  ): MeiEditionVersion {
    const current = this.get(workspaceId, edition.editionId);
    if (current.version !== expectedVersion) {
      throw new ApiRouteError(
        `MEI Edition parent is stale: expected v${expectedVersion}, current v${current.version}`,
        409
      );
    }
    const decoded = Value.Decode(MeiEditionVersionSchema, edition);
    if (decoded.version !== current.version + 1 || decoded.parentVersion !== current.version) {
      throw new ApiRouteError("MEI Edition successor has an invalid version lineage", 400);
    }
    const directory = this.editionDirectory(workspaceId, edition.editionId);
    this.writeVersion(directory, decoded);
    this.writeHead(directory, decoded.version);
    return decoded;
  }

  private assertSource(workspaceId: string, sourceArtifactId: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace.sourceArtifactIds.includes(sourceArtifactId)) {
      throw new ApiRouteError(
        `MEI Edition source is not part of workspace: ${sourceArtifactId}`,
        400
      );
    }
    this.workspaces.getSourceArtifact(workspaceId, sourceArtifactId);
  }

  private editionDirectory(workspaceId: string, editionId: string): string {
    return path.join(this.rootDirectory, workspaceId, "records", "mei-editions", editionId);
  }

  private versionPath(directory: string, version: number): string {
    return path.join(directory, `v${String(version).padStart(6, "0")}.json`);
  }

  private readHead(directory: string): number {
    try {
      const value = JSON.parse(readFileSync(path.join(directory, "head.json"), "utf8")) as {
        version?: unknown;
      };
      if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error();
      return Number(value.version);
    } catch {
      throw new ApiRouteError("MEI Edition not found", 404);
    }
  }

  private writeVersion(directory: string, edition: MeiEditionVersion): void {
    const target = this.versionPath(directory, edition.version);
    try {
      writeFileSync(target, `${JSON.stringify(edition, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    } catch {
      throw new ApiRouteError(`MEI Edition version already exists: v${edition.version}`, 409);
    }
  }

  private writeHead(directory: string, version: number): void {
    const temporary = path.join(directory, `.head.${process.pid}.tmp`);
    writeFileSync(temporary, `${JSON.stringify({ version })}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, path.join(directory, "head.json"));
  }
}
