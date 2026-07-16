import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { ReferenceRecordRefSchema } from "../../lib/reference-source-domain.js";
import {
  ReferenceSourceOperationGateway,
  ReferenceSourceOperationRequestError,
  ReferenceSourceOperationRequestSchema,
  type ReferenceSourceOperationEffects,
  type ReferenceSourceOperationRequest,
  type ReferenceSourceOperationResult,
} from "./reference-source-operation-gateway.js";

const Strict = { additionalProperties: false } as const;

export const ReferenceSourceCompilerInputRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    acquisitionRef: ReferenceRecordRefSchema,
    purpose: Type.String({ minLength: 1, maxLength: 512, pattern: "\\S" }),
  },
  Strict
);
export type ReferenceSourceCompilerInputRequest = Static<
  typeof ReferenceSourceCompilerInputRequestSchema
>;

export type ReferenceSourceProtectedOperationSink = (
  input: Parameters<ReferenceSourceOperationEffects["writeSink"]>[0]
) => void | Promise<void>;

/**
 * Concrete internal effects are named rather than supplied per call. This
 * prevents a request body from substituting an attacker-controlled reader,
 * provider, compiler, or disclosure sink after an access decision is made.
 */
export type ReferenceSourceProtectedOperationSinks = Readonly<{
  localReview: ReferenceSourceProtectedOperationSink;
  compilerInput: ReferenceSourceProtectedOperationSink;
  provider: ReferenceSourceProtectedOperationSink;
  knowledgeAuthority: ReferenceSourceProtectedOperationSink;
  fixtureRepository: ReferenceSourceProtectedOperationSink;
  sourceRepository: ReferenceSourceProtectedOperationSink;
  export: ReferenceSourceProtectedOperationSink;
  redistribution: ReferenceSourceProtectedOperationSink;
  report: ReferenceSourceProtectedOperationSink;
  log: ReferenceSourceProtectedOperationSink;
}>;

export type ReferenceSourceProtectedOperationSinkName =
  keyof ReferenceSourceProtectedOperationSinks;

/**
 * A controlled source-bearing workflow has no production implementation yet.
 *
 * This error is deliberately bounded to the public workflow name. It never
 * includes the acquisition, destination, purpose, capability, or source bytes.
 */
export class ReferenceSourceProtectedOperationUnavailableError extends Error {
  readonly code = "reference_source_protected_operation_not_configured" as const;

  constructor(readonly sinkName: ReferenceSourceProtectedOperationSinkName) {
    super(`Protected reference-source workflow is not configured: ${sinkName}`);
    this.name = "ReferenceSourceProtectedOperationUnavailableError";
  }
}

/**
 * Complete fail-closed production registry for workflows that do not yet have
 * an authorized source-bearing implementation. Keeping every named sink here
 * makes an omitted workflow a hard failure after authorization rather than an
 * accidental no-op or a fall-through to an unrelated service.
 */
export function createFailClosedReferenceSourceProtectedOperationSinks(): ReferenceSourceProtectedOperationSinks {
  return Object.freeze({
    localReview: unavailableSink("localReview"),
    compilerInput: unavailableSink("compilerInput"),
    provider: unavailableSink("provider"),
    knowledgeAuthority: unavailableSink("knowledgeAuthority"),
    fixtureRepository: unavailableSink("fixtureRepository"),
    sourceRepository: unavailableSink("sourceRepository"),
    export: unavailableSink("export"),
    redistribution: unavailableSink("redistribution"),
    report: unavailableSink("report"),
    log: unavailableSink("log"),
  });
}

export type ReferenceSourceServerCapabilityResolver = (
  request: Readonly<ReferenceSourceOperationRequest>
) => unknown | Promise<unknown>;

export type ReferenceSourceProtectedOperationAdapterOptions = Readonly<{
  gateway: ReferenceSourceOperationGateway;
  readControlledBytes: ReferenceSourceOperationEffects["readControlledBytes"];
  sinks: ReferenceSourceProtectedOperationSinks;
  /**
   * Optional server-only authority seam. Absence is the owner-private default
   * and supplies no capability. Callers cannot pass a capability to execute().
   * Any future resolver must still satisfy the gateway's exact-scope verifier.
   */
  resolveServerCapability?: ReferenceSourceServerCapabilityResolver;
}>;

/**
 * The production-owned bridge from reference-source policy to real effects.
 *
 * Every controlled-byte read and named sink remains behind the operation
 * gateway. Public methods accept only closed request contracts; neither accepts
 * effects or an allow capability. A configured server resolver cannot grant by
 * itself: the gateway must independently verify its result over the immutable
 * snapshot, acquisition, destination, operation, and purpose scope.
 */
export class ReferenceSourceProtectedOperationAdapter {
  private readonly gateway: ReferenceSourceOperationGateway;
  private readonly readControlledBytes: ReferenceSourceOperationEffects["readControlledBytes"];
  private readonly sinks: ReferenceSourceProtectedOperationSinks;
  private readonly resolveServerCapability: ReferenceSourceServerCapabilityResolver | undefined;

  constructor(options: ReferenceSourceProtectedOperationAdapterOptions) {
    this.gateway = options.gateway;
    this.readControlledBytes = options.readControlledBytes;
    this.sinks = Object.freeze({ ...options.sinks });
    this.resolveServerCapability = options.resolveServerCapability;
  }

  async execute(request: ReferenceSourceOperationRequest): Promise<ReferenceSourceOperationResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = decodeOperationRequest(request);
    return await this.executeWithSink(decoded, sinkForOperation(this.sinks, decoded.operation));
  }

  /**
   * Narrow boundary for any future path that proposes controlled source bytes
   * as compiler input. The caller cannot choose another operation, destination,
   * sink, or capability; owner-private defaults therefore stop before reading
   * bytes or invoking the compiler. Even a configured general capability
   * resolver is intentionally ignored: `local_extraction` authority is not a
   * compiler-input grant. A dedicated operation and authority contract must be
   * introduced before this boundary can ever execute effects.
   */
  async executeCompilerInput(
    request: ReferenceSourceCompilerInputRequest
  ): Promise<ReferenceSourceOperationResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = decodeCompilerInputRequest(request);
    return await this.executeWithSink(
      freezeOperationRequest({
        schemaVersion: 1,
        acquisitionRef: decoded.acquisitionRef,
        operation: "local_extraction",
        destination: { kind: "local_runtime" },
        purpose: decoded.purpose,
      }),
      this.sinks.compilerInput,
      false
    );
  }

  private async executeWithSink(
    request: Readonly<ReferenceSourceOperationRequest>,
    sink: ReferenceSourceProtectedOperationSink,
    resolveCapability = true
  ): Promise<ReferenceSourceOperationResult> {
    let capability: unknown = undefined;
    if (resolveCapability && this.resolveServerCapability) {
      try {
        capability = await this.resolveServerCapability(request);
      } catch {
        // Authority lookup failures preserve the owner-private default. The
        // bounded gateway result intentionally does not disclose the failure.
      }
    }

    const effects = Object.freeze({
      readControlledBytes: this.readControlledBytes,
      writeSink: sink,
    }) satisfies ReferenceSourceOperationEffects;
    return await this.gateway.execute(request, effects, capability);
  }
}

function decodeOperationRequest(
  request: ReferenceSourceOperationRequest
): Readonly<ReferenceSourceOperationRequest> {
  try {
    return freezeOperationRequest(Value.Decode(ReferenceSourceOperationRequestSchema, request));
  } catch {
    throw new ReferenceSourceOperationRequestError();
  }
}

function decodeCompilerInputRequest(
  request: ReferenceSourceCompilerInputRequest
): Readonly<ReferenceSourceCompilerInputRequest> {
  try {
    const decoded = Value.Decode(ReferenceSourceCompilerInputRequestSchema, request);
    return Object.freeze({
      ...decoded,
      acquisitionRef: Object.freeze({ ...decoded.acquisitionRef }),
    });
  } catch {
    throw new ReferenceSourceOperationRequestError();
  }
}

function freezeOperationRequest(
  request: ReferenceSourceOperationRequest
): Readonly<ReferenceSourceOperationRequest> {
  return Object.freeze({
    ...request,
    acquisitionRef: Object.freeze({ ...request.acquisitionRef }),
    destination: Object.freeze({ ...request.destination }),
  });
}

function sinkForOperation(
  sinks: ReferenceSourceProtectedOperationSinks,
  operation: ReferenceSourceOperationRequest["operation"]
): ReferenceSourceProtectedOperationSink {
  switch (operation) {
    case "underlying_work_use":
    case "manifestation_use":
    case "exemplar_access":
    case "scan_provider_use":
    case "owner_private_study":
    case "local_extraction":
      return sinks.localReview;
    case "provider_ocr":
    case "provider_omr":
    case "provider_translation":
    case "provider_model_processing":
      return sinks.provider;
    case "pack_citation":
    case "pack_excerpt":
      return sinks.knowledgeAuthority;
    case "fixture_inclusion":
      return sinks.fixtureRepository;
    case "repository_inclusion":
      return sinks.sourceRepository;
    case "export":
      return sinks.export;
    case "redistribution":
      return sinks.redistribution;
    case "report":
      return sinks.report;
    case "log":
      return sinks.log;
    default:
      return assertNever(operation);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported protected reference-source operation: ${String(value)}`);
}

function unavailableSink(
  sinkName: ReferenceSourceProtectedOperationSinkName
): ReferenceSourceProtectedOperationSink {
  return Object.freeze(() => {
    throw new ReferenceSourceProtectedOperationUnavailableError(sinkName);
  });
}
