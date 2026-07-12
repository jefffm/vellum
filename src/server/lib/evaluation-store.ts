import { linkSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  EvaluationCardSchema,
  EvaluationBaselineSchema,
  EvaluationCaseRunSchema,
  EvaluationComparisonSchema,
  EvaluationReportSchema,
  EvaluationRunSchema,
  ResolvedEvaluationManifestSchema,
  type EvaluationCard,
  type EvaluationBaseline,
  type EvaluationCaseRun,
  type EvaluationComparison,
  type EvaluationReport,
  type EvaluationRun,
  type ResolvedEvaluationManifest,
} from "../../lib/evaluation-domain.js";

export class EvaluationStore {
  readonly rootDirectory: string;

  constructor(options: { rootDirectory?: string } = {}) {
    this.rootDirectory =
      options.rootDirectory ?? path.resolve(process.cwd(), ".vellum/evaluations");
    mkdirSync(this.rootDirectory, { recursive: true, mode: 0o700 });
  }

  saveManifest(value: ResolvedEvaluationManifest): ResolvedEvaluationManifest {
    return this.write("manifests", value.id, ResolvedEvaluationManifestSchema, value);
  }

  getManifest(id: string): ResolvedEvaluationManifest {
    return this.read("manifests", id, ResolvedEvaluationManifestSchema);
  }

  saveCaseRun(value: EvaluationCaseRun): EvaluationCaseRun {
    validateCaseRun(value);
    return this.write("case-runs", value.id, EvaluationCaseRunSchema, value);
  }

  getCaseRun(id: string): EvaluationCaseRun {
    return this.read("case-runs", id, EvaluationCaseRunSchema);
  }

  saveRun(value: EvaluationRun): EvaluationRun {
    const history = this.getRunHistory(value.id);
    validateRunTransition(history.at(-1), value);
    return this.write(
      path.join("runs", value.id),
      String(history.length + 1).padStart(6, "0"),
      EvaluationRunSchema,
      value
    );
  }

  getRun(id: string): EvaluationRun {
    const history = this.getRunHistory(id);
    const latest = history.at(-1);
    if (!latest) throw new Error(`Evaluation Run not found: ${id}`);
    return latest;
  }

  getRunHistory(id: string): EvaluationRun[] {
    const directory = path.join(this.rootDirectory, "runs", id);
    try {
      return readdirSync(directory)
        .filter((name) => /^\d{6}\.json$/.test(name))
        .sort()
        .map((name) =>
          Value.Decode(
            EvaluationRunSchema,
            JSON.parse(readFileSync(path.join(directory, name), "utf8"))
          )
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  saveCard(value: EvaluationCard): EvaluationCard {
    return this.write("cards", value.id, EvaluationCardSchema, value);
  }

  getCard(id: string): EvaluationCard {
    return this.read("cards", id, EvaluationCardSchema);
  }

  getCardForCaseRun(caseRunId: string): EvaluationCard | undefined {
    const directory = path.join(this.rootDirectory, "cards");
    try {
      const matches = readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .map((name) => this.getCard(name.slice(0, -5)))
        .filter((card) => card.caseRunId === caseRunId);
      if (matches.length > 1)
        throw new Error(`Multiple Evaluation Cards for Case Run ${caseRunId}`);
      return matches[0];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  saveBaseline(value: EvaluationBaseline): EvaluationBaseline {
    return this.write("baselines", value.id, EvaluationBaselineSchema, value);
  }

  getBaseline(id: string): EvaluationBaseline {
    return this.read("baselines", id, EvaluationBaselineSchema);
  }

  saveComparison(value: EvaluationComparison): EvaluationComparison {
    return this.write("comparisons", value.id, EvaluationComparisonSchema, value);
  }

  getComparison(id: string): EvaluationComparison {
    return this.read("comparisons", id, EvaluationComparisonSchema);
  }

  saveReport(value: EvaluationReport): EvaluationReport {
    return this.write("reports", value.id, EvaluationReportSchema, value);
  }

  getReport(id: string): EvaluationReport {
    return this.read("reports", id, EvaluationReportSchema);
  }

  private write<T>(directory: string, id: string, schema: TSchema, value: T): T {
    if (!Value.Check(schema, value)) {
      const detail = [...Value.Errors(schema, value)]
        .slice(0, 5)
        .map((error) => `${error.path || "/"}: ${error.message}`)
        .join("; ");
      throw new Error(`Invalid evaluation record ${id}: ${detail}`);
    }
    const decoded = Value.Decode(schema, value) as T;
    const targetDirectory = path.join(this.rootDirectory, directory);
    mkdirSync(targetDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(targetDirectory, `${id}.json`);
    const temporary = path.join(targetDirectory, `.${id}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, `${canonicalJson(decoded)}\n`, { flag: "wx", mode: 0o600 });
      linkSync(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = this.read(directory, id, schema);
      if (canonicalJson(existing) !== canonicalJson(decoded)) {
        throw new Error(`Immutable evaluation record collision for ${id}`);
      }
    } finally {
      try {
        unlinkSync(temporary);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return decoded;
  }

  private read<T>(directory: string, id: string, schema: TSchema): T {
    return Value.Decode(
      schema,
      JSON.parse(readFileSync(path.join(this.rootDirectory, directory, `${id}.json`), "utf8"))
    ) as T;
  }
}

function validateRunTransition(previous: EvaluationRun | undefined, next: EvaluationRun): void {
  if (!previous) {
    if (
      next.executionStatus !== "running" ||
      next.caseRunIds.length !== 0 ||
      next.completedAt !== undefined
    ) {
      throw new Error("An Evaluation Run must begin in running state without case results");
    }
    return;
  }
  if (previous.id !== next.id || previous.manifestId !== next.manifestId) {
    throw new Error("Evaluation Run identity and Manifest cannot change across state snapshots");
  }
  if (previous.executionStatus !== "running") {
    throw new Error(`Evaluation Run ${next.id} is already terminal`);
  }
  if (next.executionStatus === "running" || !next.completedAt) {
    throw new Error("Evaluation Run terminal state requires completion time");
  }
  if (next.startedAt !== previous.startedAt) {
    throw new Error("Evaluation Run start time cannot change");
  }
}

function validateCaseRun(value: EvaluationCaseRun): void {
  const expectedReason = {
    pass: undefined,
    fail: "hard_gate_failed",
    blocked: ["source_blocked", "infrastructure_failed"],
    incomplete: "required_evidence_missing",
  } as const;
  const expected = expectedReason[value.acceptanceStatus];
  const valid = Array.isArray(expected)
    ? expected.includes(value.blockedReason as (typeof expected)[number])
    : value.blockedReason === expected;
  if (!valid) {
    throw new Error(
      `Evaluation Case Run ${value.id} has inconsistent acceptance and blocked reason`
    );
  }
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
