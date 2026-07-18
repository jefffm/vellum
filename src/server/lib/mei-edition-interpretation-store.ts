import { type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  EditionAcceptanceDecisionSchema,
  TablatureInterpretationSchema,
  type EditionAcceptanceDecision,
  type TablatureInterpretation,
} from "../../lib/mei-edition-domain.js";
import { ApiRouteError } from "./create-route.js";
import { MeiEditionStore } from "./mei-edition-store.js";
import { workspaceRootDirectory } from "./workspace-store.js";

export class MeiEditionInterpretationStore {
  readonly rootDirectory: string;
  private readonly editions: MeiEditionStore;

  constructor(options: { rootDirectory?: string; editions?: MeiEditionStore } = {}) {
    this.rootDirectory = options.rootDirectory ?? workspaceRootDirectory();
    this.editions = options.editions ?? new MeiEditionStore({ rootDirectory: this.rootDirectory });
  }

  listInterpretations(workspaceId: string, editionId: string): TablatureInterpretation[] {
    this.editions.get(workspaceId, editionId);
    return this.readDirectory(
      this.directory(workspaceId, editionId, "interpretations"),
      TablatureInterpretationSchema
    ).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  getInterpretation(
    workspaceId: string,
    editionId: string,
    interpretationId: string
  ): TablatureInterpretation {
    this.editions.get(workspaceId, editionId);
    try {
      return Value.Decode(
        TablatureInterpretationSchema,
        JSON.parse(
          readFileSync(
            path.join(
              this.directory(workspaceId, editionId, "interpretations"),
              `${interpretationId}.json`
            ),
            "utf8"
          )
        )
      );
    } catch {
      throw new ApiRouteError(`Tablature Interpretation not found: ${interpretationId}`, 404);
    }
  }

  saveInterpretation(
    workspaceId: string,
    editionId: string,
    interpretation: TablatureInterpretation
  ): TablatureInterpretation {
    this.editions.get(workspaceId, editionId);
    const decoded = Value.Decode(TablatureInterpretationSchema, interpretation);
    if (decoded.editionId !== editionId)
      throw new ApiRouteError("Tablature Interpretation belongs to another edition", 400);
    this.writeImmutable(
      this.directory(workspaceId, editionId, "interpretations"),
      decoded.id,
      decoded
    );
    return decoded;
  }

  listDecisions(workspaceId: string, editionId: string): EditionAcceptanceDecision[] {
    this.editions.get(workspaceId, editionId);
    return this.readDirectory(
      this.directory(workspaceId, editionId, "acceptance-decisions"),
      EditionAcceptanceDecisionSchema
    ).sort((left, right) => left.decidedAt.localeCompare(right.decidedAt));
  }

  saveDecision(
    workspaceId: string,
    editionId: string,
    decision: EditionAcceptanceDecision
  ): EditionAcceptanceDecision {
    this.editions.get(workspaceId, editionId);
    const decoded = Value.Decode(EditionAcceptanceDecisionSchema, decision);
    if (decoded.editionId !== editionId)
      throw new ApiRouteError("Acceptance Decision belongs to another edition", 400);
    this.writeImmutable(
      this.directory(workspaceId, editionId, "acceptance-decisions"),
      decoded.id,
      decoded
    );
    return decoded;
  }

  private directory(workspaceId: string, editionId: string, child: string): string {
    return path.join(this.rootDirectory, workspaceId, "records", "mei-editions", editionId, child);
  }

  private readDirectory<T extends TSchema>(directory: string, schema: T): Static<T>[] {
    try {
      return readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .map((name) =>
          Value.Decode(schema, JSON.parse(readFileSync(path.join(directory, name), "utf8")))
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private writeImmutable(directory: string, id: string, value: unknown): void {
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(path.join(directory, `${id}.json`), `${JSON.stringify(value, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
    } catch {
      throw new ApiRouteError(`Immutable edition record already exists: ${id}`, 409);
    }
  }
}
