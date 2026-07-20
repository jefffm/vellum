import { Value } from "@sinclair/typebox/value";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  HistoricalTabRecognitionRunSchema,
  HistoricalTabRecognitionProfileSchema,
  type HistoricalTabRecognitionProfile,
  type HistoricalTabRecognitionRun,
} from "../../lib/historical-tab-recognition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { WorkspaceStore, workspaceRootDirectory } from "./workspace-store.js";

export class HistoricalTabRecognitionStore {
  readonly rootDirectory: string;
  private readonly workspaces: WorkspaceStore;

  constructor(options: { rootDirectory?: string; workspaces?: WorkspaceStore } = {}) {
    this.rootDirectory = options.rootDirectory ?? workspaceRootDirectory();
    this.workspaces =
      options.workspaces ?? new WorkspaceStore({ rootDirectory: this.rootDirectory });
  }

  save(workspaceId: string, run: HistoricalTabRecognitionRun, pageImage: Buffer): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace.sourceArtifactIds.includes(run.sourceArtifactId)) {
      throw new ApiRouteError("Historical-tab source is not part of the workspace", 400);
    }
    const decoded = Value.Decode(HistoricalTabRecognitionRunSchema, run);
    const directory = this.directory(workspaceId, decoded.id);
    mkdirSync(path.dirname(directory), { recursive: true });
    mkdirSync(directory, { recursive: false });
    writeFileSync(path.join(directory, "page.png"), pageImage, { flag: "wx", mode: 0o600 });
    writeFileSync(
      path.join(directory, "recognition.json"),
      `${JSON.stringify(decoded, null, 2)}\n`,
      {
        flag: "wx",
        mode: 0o600,
      }
    );
  }

  get(workspaceId: string, runId: string): HistoricalTabRecognitionRun {
    this.workspaces.get(workspaceId);
    try {
      return Value.Decode(
        HistoricalTabRecognitionRunSchema,
        JSON.parse(
          readFileSync(path.join(this.directory(workspaceId, runId), "recognition.json"), "utf8")
        )
      );
    } catch (error) {
      if (error instanceof ApiRouteError) throw error;
      throw new ApiRouteError(`Historical-tab recognition run not found: ${runId}`, 404);
    }
  }

  pageImage(workspaceId: string, runId: string): Buffer {
    this.get(workspaceId, runId);
    return readFileSync(path.join(this.directory(workspaceId, runId), "page.png"));
  }

  saveProfile(workspaceId: string, profile: HistoricalTabRecognitionProfile): void {
    this.workspaces.get(workspaceId);
    const decoded = Value.Decode(HistoricalTabRecognitionProfileSchema, profile);
    const target = this.profilePath(workspaceId, decoded.id);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(decoded, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }

  getProfile(workspaceId: string, profileId: string): HistoricalTabRecognitionProfile {
    this.workspaces.get(workspaceId);
    try {
      return Value.Decode(
        HistoricalTabRecognitionProfileSchema,
        JSON.parse(readFileSync(this.profilePath(workspaceId, profileId), "utf8"))
      );
    } catch {
      throw new ApiRouteError(`Historical-tab recognition profile not found: ${profileId}`, 404);
    }
  }

  private directory(workspaceId: string, runId: string): string {
    if (!workspaceId.match(/^workspace\.[a-f0-9-]{16,}$/))
      throw new ApiRouteError("Invalid workspace id", 400);
    if (!runId.match(/^tab-recognition\.[a-f0-9-]{16,}$/))
      throw new ApiRouteError("Invalid historical-tab recognition id", 400);
    return path.join(
      this.rootDirectory,
      workspaceId,
      "records",
      "historical-tab-recognition-runs",
      runId
    );
  }

  private profilePath(workspaceId: string, profileId: string): string {
    if (!workspaceId.match(/^workspace\.[a-f0-9-]{16,}$/))
      throw new ApiRouteError("Invalid workspace id", 400);
    if (!profileId.match(/^tab-profile\.[a-f0-9-]{16,}$/))
      throw new ApiRouteError("Invalid historical-tab profile id", 400);
    return path.join(
      this.rootDirectory,
      workspaceId,
      "records",
      "historical-tab-recognition-profiles",
      `${profileId}.json`
    );
  }
}
