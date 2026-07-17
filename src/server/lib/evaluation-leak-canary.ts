import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

export type EvaluationLeakBoundary =
  | "generation_input"
  | "provider_egress"
  | "tool_payload"
  | "result_commit"
  | "public_writer"
  | "log"
  | "diagnostic"
  | "repository_scan";

export type EvaluationLeakCanaryReceipt = Readonly<{
  schemaVersion: 1;
  guardVersion: "t71.v1";
  sessionId: string;
  sessionCommitment: string;
  boundary: EvaluationLeakBoundary;
  outcome: "clear" | "blocked";
  findingClassIds: readonly string[];
  checkedAt: string;
}>;

type CanaryVariant = Readonly<{ classId: string; bytes: Buffer }>;

export class EvaluationLeakCanaryError extends Error {
  constructor(readonly receipt: EvaluationLeakCanaryReceipt) {
    super(
      `Synthetic leak canary blocked ${receipt.boundary} (${receipt.findingClassIds.join(",")})`
    );
    this.name = "EvaluationLeakCanaryError";
  }
}

export class EvaluationLeakCanaryGuard {
  private active = true;
  private readonly variants: readonly CanaryVariant[];
  private readonly sessionId: string;
  private readonly sessionCommitment: string;
  private readonly createdAt: number;

  constructor(
    secret: Uint8Array,
    private readonly options: {
      now?: () => Date;
      maximumAgeMs?: number;
      sessionId?: string;
      commitmentKey?: Uint8Array;
    } = {}
  ) {
    if (secret.byteLength < 32) throw new Error("Synthetic canary secret must contain 32 bytes");
    this.variants = buildVariants(Buffer.from(secret));
    if (new Set(this.variants.map(({ classId }) => classId)).size < 8) {
      throw new Error("Synthetic canary corpus is incomplete");
    }
    this.sessionId = options.sessionId ?? `canary-session.${randomUUID()}`;
    const key = Buffer.from(options.commitmentKey ?? randomBytes(32));
    this.sessionCommitment = createHmac("sha256", key)
      .update(this.sessionId)
      .update(secret)
      .digest("hex");
    key.fill(0);
    this.createdAt = this.now().getTime();
  }

  assertSafe(boundary: EvaluationLeakBoundary, value: unknown): EvaluationLeakCanaryReceipt {
    this.assertActive();
    const candidates = candidateBuffers(value);
    const findingClassIds = this.variants
      .filter(({ bytes: variant }) => candidates.some((candidate) => candidate.includes(variant)))
      .map(({ classId }) => classId)
      .filter((classId, index, values) => values.indexOf(classId) === index)
      .sort();
    const receipt = this.receipt(boundary, findingClassIds);
    if (findingClassIds.length > 0) throw new EvaluationLeakCanaryError(receipt);
    return receipt;
  }

  assertFilesSafe(paths: readonly string[]): EvaluationLeakCanaryReceipt[] {
    this.assertActive();
    return paths.map((filePath) => this.assertSafe("repository_scan", readFileSync(filePath)));
  }

  close(): void {
    this.active = false;
    for (const variant of this.variants) variant.bytes.fill(0);
  }

  private assertActive(): void {
    if (!this.active) throw new Error("Synthetic leak canary guard is inactive");
    if (this.now().getTime() - this.createdAt > (this.options.maximumAgeMs ?? 300_000)) {
      throw new Error("Synthetic leak canary guard is stale");
    }
  }

  private receipt(
    boundary: EvaluationLeakBoundary,
    findingClassIds: readonly string[]
  ): EvaluationLeakCanaryReceipt {
    return Object.freeze({
      schemaVersion: 1,
      guardVersion: "t71.v1",
      sessionId: this.sessionId,
      sessionCommitment: this.sessionCommitment,
      boundary,
      outcome: findingClassIds.length ? "blocked" : "clear",
      findingClassIds,
      checkedAt: this.now().toISOString(),
    });
  }

  private now(): Date {
    return (this.options.now ?? (() => new Date()))();
  }
}

export function createEvaluationLeakCanaryGuard(
  options: {
    now?: () => Date;
    maximumAgeMs?: number;
  } = {}
): EvaluationLeakCanaryGuard {
  const secret = randomBytes(32);
  try {
    return new EvaluationLeakCanaryGuard(secret, options);
  } finally {
    secret.fill(0);
  }
}

/**
 * The only supported shape for a side effect that may expose evaluator data.
 * Requiring the guard at the call site makes an absent or stale guard fail before
 * the effect callback can run.
 */
export function guardedLeakBoundaryEffect<T, TResult>(
  guard: EvaluationLeakCanaryGuard | undefined,
  boundary: EvaluationLeakBoundary,
  value: T,
  effect: (safeValue: T) => TResult
): TResult {
  if (!guard) throw new Error(`Synthetic leak canary guard required for ${boundary}`);
  guard.assertSafe(boundary, value);
  return effect(value);
}

export function guardedPublicWrite<T, TResult>(
  guard: EvaluationLeakCanaryGuard | undefined,
  value: T,
  writer: (safeValue: T) => TResult
): TResult {
  return guardedLeakBoundaryEffect(guard, "public_writer", value, writer);
}

function buildVariants(secret: Buffer): CanaryVariant[] {
  const text = secret.toString("hex");
  return [
    variant("canary-class.raw", secret),
    variant("canary-class.hex", Buffer.from(text)),
    variant("canary-class.base64", Buffer.from(secret.toString("base64"))),
    variant("canary-class.base64url", Buffer.from(secret.toString("base64url"))),
    variant("canary-class.url-encoded", Buffer.from(encodeURIComponent(secret.toString("base64")))),
    variant("canary-class.compressed", Buffer.from(gzipSync(secret).toString("base64"))),
    variant("canary-class.truncated", Buffer.from(text.slice(0, 32))),
    variant("canary-class.renamed", Buffer.from([...text].reverse().join(""))),
    variant("canary-class.sha256", Buffer.from(createHash("sha256").update(secret).digest("hex"))),
    variant("canary-class.sha1", Buffer.from(createHash("sha1").update(secret).digest("hex"))),
    variant("canary-class.md5", Buffer.from(createHash("md5").update(secret).digest("hex"))),
  ];
}

function variant(classId: string, bytes: Buffer): CanaryVariant {
  return Object.freeze({ classId, bytes });
}

function serialize(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value);
  try {
    return Buffer.from(JSON.stringify(value));
  } catch {
    return Buffer.from(String(value));
  }
}

function candidateBuffers(value: unknown, seen = new Set<object>()): Buffer[] {
  if (Buffer.isBuffer(value)) return [value];
  if (value instanceof Uint8Array) return [Buffer.from(value)];
  if (typeof value === "string") return [Buffer.from(value)];
  if (typeof value !== "object" || value === null) return [serialize(value)];
  if (seen.has(value)) return [];
  seen.add(value);
  const candidates = [serialize(value)];
  if (Array.isArray(value)) {
    for (const item of value) candidates.push(...candidateBuffers(item, seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      candidates.push(Buffer.from(key), ...candidateBuffers(item, seen));
    }
  }
  return candidates;
}
