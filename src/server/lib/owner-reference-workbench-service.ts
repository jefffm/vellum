import { Value } from "@sinclair/typebox/value";
import {
  ReferencePageAtlasOperationRequestSchema,
  ReferencePageAtlasPreviewRequestSchema,
  ReferencePageAtlasProjectionSchema,
  ReferencePageAtlasReadRequestSchema,
  type ReferencePageAtlasOperationRequest,
  type ReferencePageAtlasPreviewRequest,
  type ReferencePageAtlasProjection,
} from "../../lib/reference-page-atlas-contract.js";
import {
  TypedKnowledgeReleaseOperationRequestSchema,
  TypedKnowledgeReleaseProjectionSchema,
  type TypedKnowledgeReleaseOperationRequest,
  type TypedKnowledgeReleaseProjection,
} from "../../lib/typed-knowledge-release-contract.js";
import {
  constants,
  closeSync,
  fstatSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, createHmac, randomBytes } from "node:crypto";
import path from "node:path";

import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import {
  OwnerReferenceWorkbenchLocalOperationReviewRequestSchema,
  OwnerReferenceWorkbenchLocalOperationReviewResultSchema,
  OwnerReferenceWorkbenchLocalStudyRequestSchema,
  OwnerReferenceWorkbenchSnapshotSchema,
  OwnerReferenceWorkbenchUploadConfirmationRequestSchema,
  OwnerReferenceWorkbenchUploadConfirmationResultSchema,
  type OwnerReferenceWorkbenchAccessExplanation,
  type OwnerReferenceWorkbenchLocalOperationReviewRequest,
  type OwnerReferenceWorkbenchLocalOperationReviewResult,
  type OwnerReferenceWorkbenchLocalStudyRequest,
  type OwnerReferenceWorkbenchMigration,
  type OwnerReferenceWorkbenchSnapshot,
  type OwnerReferenceWorkbenchUploadConfirmationRequest,
  type OwnerReferenceWorkbenchUploadConfirmationResult,
} from "../../lib/owner-reference-workbench-contract.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
  type ReferenceAssetAcquisition,
  type ReferenceAssetRoleBinding,
  type ReferenceAssetIdentityResolution,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingRecord,
} from "../../lib/reference-source-domain.js";
import type {
  OwnerReferencePageAtlasPreview,
  OwnerReferencePageAtlasResolvedContext,
  OwnerReferencePageAtlasService,
} from "./owner-reference-page-atlas-service.js";
import type {
  OwnerReferenceMigrationCompatibilityView,
  OwnerReferenceMigrationService,
} from "./owner-reference-migration-service.js";
import type { ReferenceSourceControlledArtifactStore } from "./reference-source-controlled-artifact-store.js";
import type {
  ReferenceSourceOperationEffects,
  ReferenceSourceOperationGateway,
} from "./reference-source-operation-gateway.js";
import {
  OwnerReferenceLocalStudyUnavailableError,
  type OwnerReferenceLocalStudyExecutionResult,
  type OwnerReferenceLocalStudyService,
  type OwnerReferenceLocalStudySink,
} from "./owner-reference-local-study-service.js";
import type {
  ReferenceSourceStagingDiagnostics,
  ReferenceSourceStagingService,
} from "./reference-source-staging-service.js";
import {
  assertReferenceSourceStagingSnapshotIntegrity,
  OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF,
} from "./reference-source-staging-service.js";

type StagingReader = Pick<ReferenceSourceStagingService, "readCurrent">;
type MigrationCompatibilityReader = Pick<OwnerReferenceMigrationService, "readCompatibility">;
type ControlledArtifactInventoryReader = Pick<ReferenceSourceControlledArtifactStore, "observe">;
type DefaultOperationGateway = Pick<ReferenceSourceOperationGateway, "execute">;
type LocalStudyExecutor = Pick<OwnerReferenceLocalStudyService, "execute">;
type PageAtlasExecutor = Pick<
  OwnerReferencePageAtlasService,
  "start" | "read" | "resume" | "cancel" | "correctMapping" | "preview"
>;
type TypedKnowledgeReleaseExecutor = Readonly<{
  execute: (
    input: Readonly<{
      request: TypedKnowledgeReleaseOperationRequest;
      context: OwnerReferencePageAtlasResolvedContext;
      signal?: AbortSignal;
    }>
  ) => TypedKnowledgeReleaseProjection | Promise<TypedKnowledgeReleaseProjection>;
}>;

export type OwnerReferenceWorkbenchServiceOptions = {
  staging: StagingReader;
  migration: MigrationCompatibilityReader;
  controlledArtifacts: ControlledArtifactInventoryReader;
  opaqueProjector: OwnerReferenceWorkbenchOpaqueProjector;
  operationGateway?: DefaultOperationGateway;
  localStudyService?: LocalStudyExecutor;
  pageAtlasService?: PageAtlasExecutor;
  typedKnowledgeReleaseService?: TypedKnowledgeReleaseExecutor;
  maxSnapshotAttempts?: number;
};

const OPAQUE_KEY_BYTES = 32;
const DEFAULT_SNAPSHOT_ATTEMPTS = 3;
const OPAQUE_KEY_FILENAME = "opaque-projection.key";

const PRIVATE_DEFAULT_POLICY_REF = externalRef("policy.owner-reference-private-defaults.v1");
const MIGRATION_MAPPING_ID = /^owner-reference-migration-mapping\.([a-f0-9]{32})$/;
const MIGRATED_ACQUISITION_ID = /^acquisition\.legacy-owner-reference\.([a-f0-9]{32})$/;

const ACCESS_EXPLANATIONS: readonly OwnerReferenceWorkbenchAccessExplanation[] = Object.freeze([
  {
    operation: "local_study",
    status: "review_required",
    explanation:
      "Owner-private local study requires an explicit Owner authorization and conveys no historical or specialist authority.",
  },
  {
    operation: "local_extraction",
    status: "review_required",
    explanation:
      "Local extraction requires an operation-specific Access Decision and remains local-only.",
  },
  {
    operation: "provider_egress",
    status: "deny",
    explanation:
      "Provider egress is denied until an exact destination- and purpose-scoped Access Decision is authorized.",
  },
  {
    operation: "fixture_inclusion",
    status: "deny",
    explanation:
      "Fixture inclusion is denied until repository inclusion and redistribution are explicitly authorized.",
  },
  {
    operation: "repository_inclusion",
    status: "deny",
    explanation:
      "Repository inclusion is denied until exact source and derivative rights are explicitly authorized.",
  },
  {
    operation: "export",
    status: "deny",
    explanation:
      "Export is denied until an operation-specific Access Decision authorizes the exact destination and purpose.",
  },
  {
    operation: "redistribution",
    status: "deny",
    explanation:
      "Redistribution is denied until an evidence-bearing rights decision explicitly permits it.",
  },
  {
    operation: "report",
    status: "deny",
    explanation:
      "Source-bearing reports are denied until their exact source, derivative, destination, and purpose are authorized.",
  },
  {
    operation: "log",
    status: "deny",
    explanation:
      "Source identity and content are excluded from logs unless an explicit bounded logging decision permits them.",
  },
]);

/** Keyed, non-resolving projection of private graph identities. */
export class OwnerReferenceWorkbenchOpaqueProjector {
  private readonly key: Buffer;

  constructor(key: Uint8Array) {
    if (key.byteLength !== OPAQUE_KEY_BYTES) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Workbench opaque projection key is invalid"
      );
    }
    this.key = Buffer.from(key);
  }

  project(kind: string, value: unknown): ReferenceRecordRef {
    const digest = createHmac("sha256", this.key)
      .update(
        canonicalReferenceJson({
          domain: "vellum.owner-reference-workbench.opaque-ref.v2",
          kind,
          value,
        })
      )
      .digest("hex");
    return { id: `owner-reference-${kind}.${digest.slice(0, 24)}`, digest };
  }
}

/**
 * Load the server-local projector key, creating it atomically with owner-only
 * permissions on first use. The key never enters a Workbench response.
 */
export function loadOrCreateOwnerReferenceWorkbenchOpaqueProjector(
  rootDirectory: string,
  testHooks: { beforePublish?: () => void } = {}
): OwnerReferenceWorkbenchOpaqueProjector {
  mkdirSync(rootDirectory, { recursive: true, mode: 0o700 });
  const keyPath = path.join(rootDirectory, OPAQUE_KEY_FILENAME);
  const candidate = randomBytes(OPAQUE_KEY_BYTES);
  const temporaryPath = path.join(
    rootDirectory,
    `${OPAQUE_KEY_FILENAME}.tmp.${process.pid}.${randomBytes(12).toString("hex")}`
  );
  let createdDescriptor: number | undefined;
  try {
    createdDescriptor = openSync(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600
    );
    writeFileSync(createdDescriptor, candidate);
    fsyncSync(createdDescriptor);
    closeSync(createdDescriptor);
    createdDescriptor = undefined;
    testHooks.beforePublish?.();
    try {
      linkSync(temporaryPath, keyPath);
      fsyncDirectory(rootDirectory);
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }
  } catch (error) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference Workbench opaque projection key could not be created"
    );
  } finally {
    if (createdDescriptor !== undefined) closeSync(createdDescriptor);
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw new OwnerReferenceWorkbenchIntegrityError(
          "The Owner-reference Workbench temporary projection key could not be removed"
        );
      }
    }
  }

  let readDescriptor: number | undefined;
  try {
    readDescriptor = openSync(keyPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(readDescriptor);
    if (!stat.isFile() || stat.size !== OPAQUE_KEY_BYTES || (stat.mode & 0o077) !== 0) {
      throw new Error("invalid opaque projection key file");
    }
    return new OwnerReferenceWorkbenchOpaqueProjector(readFileSync(readDescriptor));
  } catch {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference Workbench opaque projection key is unavailable or unsafe"
    );
  } finally {
    if (readDescriptor !== undefined) closeSync(readDescriptor);
  }
}

/**
 * Read-only Owner-reference Workbench projection.
 *
 * The projection deliberately exposes fresh opaque commitments instead of
 * source record IDs or digests. It reads each underlying compatibility view
 * exactly once, joins only exact migration acquisitions and controlled uploads
 * with healthy persisted-byte bindings, and never returns source labels,
 * filenames, paths, content, or raw content identity.
 */
export class OwnerReferenceWorkbenchService {
  private readonly staging: StagingReader;
  private readonly migration: MigrationCompatibilityReader;
  private readonly controlledArtifacts: ControlledArtifactInventoryReader;
  private readonly opaqueProjector: OwnerReferenceWorkbenchOpaqueProjector;
  private readonly operationGateway: DefaultOperationGateway | undefined;
  private readonly localStudyService: LocalStudyExecutor | undefined;
  private readonly pageAtlasService: PageAtlasExecutor | undefined;
  private readonly typedKnowledgeReleaseService: TypedKnowledgeReleaseExecutor | undefined;
  private readonly maxSnapshotAttempts: number;

  constructor(options: OwnerReferenceWorkbenchServiceOptions) {
    this.staging = options.staging;
    this.migration = options.migration;
    this.controlledArtifacts = options.controlledArtifacts;
    this.opaqueProjector = options.opaqueProjector;
    this.operationGateway = options.operationGateway;
    this.localStudyService = options.localStudyService;
    this.pageAtlasService = options.pageAtlasService;
    this.typedKnowledgeReleaseService = options.typedKnowledgeReleaseService;
    this.maxSnapshotAttempts = options.maxSnapshotAttempts ?? DEFAULT_SNAPSHOT_ATTEMPTS;
    if (!Number.isSafeInteger(this.maxSnapshotAttempts) || this.maxSnapshotAttempts < 1) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Workbench snapshot retry bound is invalid"
      );
    }
  }

  read(): OwnerReferenceWorkbenchSnapshot {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    return this.captureProjection().snapshot;
  }

  confirmUpload(
    request: OwnerReferenceWorkbenchUploadConfirmationRequest
  ): OwnerReferenceWorkbenchUploadConfirmationResult {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = Value.Decode(OwnerReferenceWorkbenchUploadConfirmationRequestSchema, request);
    const expectedAcquisitionId = `acquisition.owner-upload.${createHash("sha256")
      .update(decoded.acquisitionKey)
      .digest("hex")
      .slice(0, 32)}`;
    const projection = this.captureProjection();
    const cardRefKey = [...projection.acquisitionByCardRef.entries()].find(
      ([, acquisition]) => acquisition.id === expectedAcquisitionId
    )?.[0];
    const cardRef = cardRefKey
      ? projection.snapshot.references.find((card) => refKey(card.cardRef) === cardRefKey)?.cardRef
      : undefined;
    return Value.Decode(
      OwnerReferenceWorkbenchUploadConfirmationResultSchema,
      cardRef
        ? {
            schemaVersion: 1,
            status: "present",
            snapshotRef: projection.snapshot.snapshotRef,
            cardRef,
          }
        : {
            schemaVersion: 1,
            status: "absent",
            snapshotRef: projection.snapshot.snapshotRef,
          }
    );
  }

  async reviewLocalOperation(
    request: OwnerReferenceWorkbenchLocalOperationReviewRequest
  ): Promise<OwnerReferenceWorkbenchLocalOperationReviewResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = Value.Decode(OwnerReferenceWorkbenchLocalOperationReviewRequestSchema, request);
    const projection = this.captureProjection();
    if (!refsEqual(decoded.snapshotRef, projection.snapshot.snapshotRef)) {
      return operationReviewResult(decoded.operation, "deny", "workbench_snapshot_stale");
    }
    const acquisition = projection.acquisitionByCardRef.get(refKey(decoded.cardRef));
    if (!acquisition) {
      return operationReviewResult(
        decoded.operation,
        "deny",
        "workbench_card_not_found_or_mismatched"
      );
    }
    if (!this.operationGateway) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Workbench local-operation gateway is unavailable"
      );
    }
    const gatewayResult = await this.operationGateway.execute(
      {
        schemaVersion: 1,
        acquisitionRef: refFor(acquisition),
        operation: decoded.operation,
        destination: { kind: "local_runtime" },
        purpose: decoded.purpose,
      },
      SEALED_LOCAL_REVIEW_EFFECTS
    );
    const current = this.captureProjection();
    if (
      !refsEqual(current.snapshot.snapshotRef, projection.snapshot.snapshotRef) ||
      gatewayResult.snapshotId !== projection.stagingSnapshotId
    ) {
      return operationReviewResult(decoded.operation, "deny", "workbench_snapshot_stale");
    }
    if (
      gatewayResult.status !== "review_required" ||
      gatewayResult.reasonCode !== "owner_private_local_review_required"
    ) {
      return operationReviewResult(
        decoded.operation,
        "deny",
        "staging_snapshot_unavailable_or_invalid"
      );
    }
    return operationReviewResult(
      decoded.operation,
      "review_required",
      "owner_private_local_review_required"
    );
  }

  /**
   * Resolve one exact opaque Workbench card, then delegate the Owner-attested
   * byte read to the local-study capability boundary. Raw graph identities do
   * not cross this method's caller boundary.
   */
  async executeLocalStudy(
    request: OwnerReferenceWorkbenchLocalStudyRequest,
    sink: OwnerReferenceLocalStudySink
  ): Promise<OwnerReferenceLocalStudyExecutionResult> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = Value.Decode(OwnerReferenceWorkbenchLocalStudyRequestSchema, request);
    const projection = this.captureProjection();
    const source = projection.sourceByCardRef.get(refKey(decoded.cardRef));
    if (!source || !projection.stagingSnapshotRef || !this.localStudyService) {
      throw new OwnerReferenceLocalStudyUnavailableError();
    }
    return this.localStudyService.execute(
      {
        request: decoded,
        currentWorkbenchSnapshotRef: projection.snapshot.snapshotRef,
        currentStagingSnapshotRef: projection.stagingSnapshotRef,
        acquisition: source.acquisition,
        digitalAsset: source.digitalAsset,
      },
      sink
    );
  }

  /**
   * Resolve every opaque browser scope inside the Workbench boundary, execute
   * one Page Atlas operation, then recapture the successor Workbench snapshot
   * before projecting a mutation result. Raw graph identities never enter the
   * route or browser contract.
   */
  async executePageAtlas(
    request: ReferencePageAtlasOperationRequest,
    signal?: AbortSignal
  ): Promise<ReferencePageAtlasProjection> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = Value.Decode(ReferencePageAtlasOperationRequestSchema, request);
    const before = this.captureProjection();
    const beforeContext = this.pageAtlasContext(before, decoded.workbenchCardRef);
    const service = this.requirePageAtlasService();

    if (decoded.action === "read") {
      return Value.Decode(
        ReferencePageAtlasProjectionSchema,
        service.read({ request: decoded, context: beforeContext })
      );
    }

    const receipt =
      decoded.action === "start"
        ? await service.start({ request: decoded, context: beforeContext, signal })
        : decoded.action === "resume"
          ? await service.resume({ request: decoded, context: beforeContext, signal })
          : decoded.action === "cancel"
            ? service.cancel({ request: decoded, context: beforeContext })
            : await service.correctMapping({ request: decoded, context: beforeContext, signal });

    const after = this.captureProjection();
    const afterContext = this.pageAtlasContext(after, decoded.workbenchCardRef);
    const readRequest = Value.Decode(ReferencePageAtlasReadRequestSchema, {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: after.snapshot.snapshotRef,
      workbenchCardRef: decoded.workbenchCardRef,
      operationRef: receipt.operationRef,
    });
    return Value.Decode(
      ReferencePageAtlasProjectionSchema,
      service.read({ request: readRequest, context: afterContext })
    );
  }

  /** Render one exact current cited page through the no-store binary route. */
  async previewPageAtlas(
    request: ReferencePageAtlasPreviewRequest
  ): Promise<OwnerReferencePageAtlasPreview> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    const decoded = Value.Decode(ReferencePageAtlasPreviewRequestSchema, request);
    const projection = this.captureProjection();
    const context = this.pageAtlasContext(projection, decoded.workbenchCardRef);
    return this.requirePageAtlasService().preview({ request: decoded, context });
  }

  /**
   * Resolve the five opaque Page Atlas commitments inside the server boundary,
   * then delegate one closed preview or publication operation. The private
   * source context is never returned to the route or browser.
   */
  async executeTypedKnowledgeRelease(
    request: TypedKnowledgeReleaseOperationRequest,
    signal?: AbortSignal
  ): Promise<TypedKnowledgeReleaseProjection> {
    assertAuthorityPathRuntime("authority.validator.reference-source-governance", "production");
    assertAuthorityPathRuntime("authority.validator.reviewed-knowledge-governance", "production");
    const decoded = Value.Decode(TypedKnowledgeReleaseOperationRequestSchema, request);
    const projection = this.captureProjection();
    const context = this.pageAtlasContext(projection, decoded.selection.workbenchCardRef);
    const service = this.typedKnowledgeReleaseService;
    if (!service) {
      throw Object.assign(new Error("Typed knowledge release service is unavailable"), {
        code: "typed_knowledge_release_unavailable",
      });
    }
    const result = await service.execute({ request: decoded, context, signal });
    return Value.Decode(TypedKnowledgeReleaseProjectionSchema, result);
  }

  private requirePageAtlasService(): PageAtlasExecutor {
    if (!this.pageAtlasService) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Page Atlas service is unavailable"
      );
    }
    return this.pageAtlasService;
  }

  private pageAtlasContext(
    projection: WorkbenchProjection,
    cardRef: ReferenceRecordRef
  ): OwnerReferencePageAtlasResolvedContext {
    const source = projection.sourceByCardRef.get(refKey(cardRef));
    if (!source || !projection.stagingSnapshotRef) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Page Atlas card is unavailable"
      );
    }
    return Object.freeze({
      currentWorkbenchSnapshotRef: projection.snapshot.snapshotRef,
      currentWorkbenchCardRef: cardRef,
      currentStagingSnapshotRef: projection.stagingSnapshotRef,
      acquisition: source.acquisition,
      digitalAsset: source.digitalAsset,
    });
  }

  private captureProjection(): WorkbenchProjection {
    let lastIntegrityError: OwnerReferenceWorkbenchIntegrityError | undefined;
    for (let attempt = 0; attempt < this.maxSnapshotAttempts; attempt += 1) {
      const before = this.captureInputs();
      const after = this.captureInputs();
      if (
        referenceSourceDigest(coherenceReceipt(before)) !==
        referenceSourceDigest(coherenceReceipt(after))
      ) {
        continue;
      }
      try {
        assertCoherentStagingState(after.staging);
        assertMigrationGraphSetEquality(after.staging, after.migration);
        const built = buildCards(
          after.staging,
          after.migration,
          after.controlledArtifacts,
          this.opaqueProjector
        );
        const snapshotRef = this.opaqueProjector.project("snapshot", coherenceReceipt(after));
        const snapshot = Value.Decode(OwnerReferenceWorkbenchSnapshotSchema, {
          schemaVersion: 1,
          snapshotRef,
          references: built.references,
        });
        return {
          snapshot,
          acquisitionByCardRef: built.acquisitionByCardRef,
          sourceByCardRef: built.sourceByCardRef,
          stagingSnapshotId: after.staging.snapshot?.id ?? null,
          stagingSnapshotRef: after.staging.snapshot ? refFor(after.staging.snapshot) : null,
        };
      } catch (error) {
        if (!(error instanceof OwnerReferenceWorkbenchIntegrityError)) throw error;
        lastIntegrityError = error;
      }
    }
    throw (
      lastIntegrityError ??
      new OwnerReferenceWorkbenchIntegrityError(
        "The Owner-reference Workbench could not capture one coherent source generation"
      )
    );
  }

  private captureInputs(): WorkbenchInputs {
    return {
      staging: this.staging.readCurrent(),
      migration: this.migration.readCompatibility(),
      controlledArtifacts: this.controlledArtifacts.observe(),
    };
  }
}

type ControlledArtifactObservation = ReturnType<ReferenceSourceControlledArtifactStore["observe"]>;

type WorkbenchInputs = Readonly<{
  staging: ReferenceSourceStagingDiagnostics;
  migration: OwnerReferenceMigrationCompatibilityView;
  controlledArtifacts: ControlledArtifactObservation;
}>;

type WorkbenchProjection = Readonly<{
  snapshot: OwnerReferenceWorkbenchSnapshot;
  acquisitionByCardRef: ReadonlyMap<string, ReferenceAssetAcquisition>;
  sourceByCardRef: ReadonlyMap<
    string,
    Readonly<{ acquisition: ReferenceAssetAcquisition; digitalAsset: ReferenceDigitalAsset }>
  >;
  stagingSnapshotId: string | null;
  stagingSnapshotRef: ReferenceRecordRef | null;
}>;

type BuiltCards = Readonly<{
  references: OwnerReferenceWorkbenchSnapshot["references"];
  acquisitionByCardRef: ReadonlyMap<string, ReferenceAssetAcquisition>;
  sourceByCardRef: ReadonlyMap<
    string,
    Readonly<{ acquisition: ReferenceAssetAcquisition; digitalAsset: ReferenceDigitalAsset }>
  >;
}>;

function assertMigrationGraphSetEquality(
  staging: ReferenceSourceStagingDiagnostics,
  migration: OwnerReferenceMigrationCompatibilityView
): void {
  const stagedSuffixes = new Set(
    (staging.snapshot?.records ?? [])
      .filter(isAssetAcquisition)
      .filter(({ origin }) => origin.sourceKind === "legacy_owner_reference")
      .map(({ id }) => id.match(MIGRATED_ACQUISITION_ID)?.[1])
      .filter((suffix): suffix is string => suffix !== undefined)
  );
  const compatibilitySuffixes = new Set(migrationStatesBySuffix(migration).keys());
  if (
    stagedSuffixes.size !== compatibilitySuffixes.size ||
    [...stagedSuffixes].some((suffix) => !compatibilitySuffixes.has(suffix)) ||
    [...compatibilitySuffixes].some((suffix) => !stagedSuffixes.has(suffix))
  ) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference migration graph and compatibility projection do not name the same exact acquisitions"
    );
  }
}

function buildCards(
  staging: ReferenceSourceStagingDiagnostics,
  migration: OwnerReferenceMigrationCompatibilityView,
  controlledArtifacts: ControlledArtifactObservation,
  opaqueProjector: OwnerReferenceWorkbenchOpaqueProjector
): BuiltCards {
  const records = staging.snapshot?.records ?? [];
  const byRef = new Map(records.map((record) => [refKey(record), record]));
  const bindings = records.filter(isRoleBinding);
  const migrationBySuffix = migrationStatesBySuffix(migration);
  const seenMigrationSuffixes = new Set<string>();
  const cards: OwnerReferenceWorkbenchSnapshot["references"] = [];
  const acquisitionByCardRef = new Map<string, ReferenceAssetAcquisition>();
  const sourceByCardRef = new Map<
    string,
    Readonly<{ acquisition: ReferenceAssetAcquisition; digitalAsset: ReferenceDigitalAsset }>
  >();

  for (const acquisition of records.filter(isAssetAcquisition)) {
    const classification = classifyCard(acquisition, migrationBySuffix, seenMigrationSuffixes);
    if (!classification) continue;
    const asset = byRef.get(refKey(acquisition.digitalAssetRef));
    if (!asset || asset.recordKind !== "digital_asset") {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "An Owner-reference acquisition has no exact Digital Asset"
      );
    }
    assertControlledArtifactBinding(asset, controlledArtifacts, classification.origin);
    acquisition.rightsAssertionRefs.forEach((reference) => {
      const rights = byRef.get(refKey(reference));
      if (!rights || rights.recordKind !== "rights_assertion") {
        throw new OwnerReferenceWorkbenchIntegrityError(
          "An Owner-reference acquisition has an unresolved Rights Assertion"
        );
      }
    });
    const rightsAssertionCount = countCurrentApplicableRightsAssertions(
      acquisition,
      asset,
      records,
      staging.snapshot!.createdAt
    );
    const identityResolutions = records.filter(
      (record): record is ReferenceAssetIdentityResolution =>
        record.recordKind === "asset_identity_resolution" &&
        refsEqual(record.digitalAssetRef, asset) &&
        record.acquisitionRefs.some((reference) => refsEqual(reference, acquisition))
    );
    const card = cardFor(
      acquisition,
      asset,
      classification,
      bindings,
      rightsAssertionCount,
      identityResolutions,
      opaqueProjector
    );
    cards.push(card);
    acquisitionByCardRef.set(refKey(card.cardRef), acquisition);
    sourceByCardRef.set(refKey(card.cardRef), {
      acquisition,
      digitalAsset: asset,
    });
  }

  if (seenMigrationSuffixes.size !== migrationBySuffix.size) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "A migrated Owner reference has no exact migrated acquisition"
    );
  }

  return {
    references: cards.sort((left, right) => left.id.localeCompare(right.id)),
    acquisitionByCardRef,
    sourceByCardRef,
  };
}

function countCurrentApplicableRightsAssertions(
  acquisition: ReferenceAssetAcquisition,
  asset: ReferenceDigitalAsset,
  records: readonly ReferenceSourceStagingRecord[],
  observedAt: string
): number {
  const embedded = new Set(acquisition.rightsAssertionRefs.map(refKey));
  const superseded = new Set(
    records.flatMap((record) =>
      record.recordKind === "rights_assertion" && record.parentVersionRef
        ? [refKey(record.parentVersionRef)]
        : []
    )
  );
  const invalidated = new Set(
    records.flatMap((record) =>
      record.recordKind === "invalidation" && record.scope === "rights"
        ? [refKey(record.invalidatedRef)]
        : []
    )
  );
  const at = Date.parse(observedAt);
  return records.filter((record) => {
    if (record.recordKind !== "rights_assertion") return false;
    const key = refKey(record);
    const directlyApplicable =
      refsEqual(record.subjectRef, acquisition) || refsEqual(record.subjectRef, asset);
    if (!embedded.has(key) && !directlyApplicable) return false;
    if (superseded.has(key) || invalidated.has(key)) return false;
    if (record.validFrom && Date.parse(record.validFrom) > at) return false;
    if (record.validUntil && Date.parse(record.validUntil) <= at) return false;
    return true;
  }).length;
}

function migrationStatesBySuffix(
  migration: OwnerReferenceMigrationCompatibilityView
): ReadonlyMap<string, OwnerReferenceWorkbenchMigration> {
  const states = new Map<string, OwnerReferenceWorkbenchMigration>();
  for (const reference of migration.ownerReferences) {
    if (!reference.mappingId) continue;
    if (reference.state === "pending") {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "A pending Owner-reference compatibility identity unexpectedly has a mapping"
      );
    }
    const match = reference.mappingId?.match(MIGRATION_MAPPING_ID);
    if (!match || states.has(match[1]!)) {
      throw new OwnerReferenceWorkbenchIntegrityError(
        "An Owner-reference compatibility mapping is invalid or duplicated"
      );
    }
    states.set(match[1]!, {
      state: reference.state,
      legacySourceState: reference.legacySourceState,
      ...(reference.quarantineReason ? { quarantineReason: reference.quarantineReason } : {}),
      explanation: migrationExplanation(reference),
    });
  }
  return states;
}

type CardClassification =
  | { origin: "upload"; migration: null }
  | { origin: "migrated"; migration: OwnerReferenceWorkbenchMigration };

function classifyCard(
  acquisition: ReferenceAssetAcquisition,
  migrationBySuffix: ReadonlyMap<string, OwnerReferenceWorkbenchMigration>,
  seenMigrationSuffixes: Set<string>
): CardClassification | null {
  if (acquisition.origin.sourceKind === "upload") {
    if (!refsEqual(acquisition.processingPolicyRef, OWNER_REFERENCE_UPLOAD_PROCESSING_POLICY_REF)) {
      return null;
    }
    return { origin: "upload", migration: null };
  }
  if (acquisition.origin.sourceKind !== "legacy_owner_reference") return null;
  const match = acquisition.id.match(MIGRATED_ACQUISITION_ID);
  if (!match) return null;
  const migration = migrationBySuffix.get(match[1]!);
  if (!migration) return null;
  if (seenMigrationSuffixes.has(match[1]!)) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "A migrated Owner-reference compatibility identity resolves more than once"
    );
  }
  seenMigrationSuffixes.add(match[1]!);
  return { origin: "migrated", migration };
}

function assertControlledArtifactBinding(
  asset: ReferenceDigitalAsset,
  controlledArtifacts: ControlledArtifactObservation,
  origin: CardClassification["origin"]
): void {
  if (controlledArtifacts.status !== "complete") {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The controlled-artifact inventory is not complete for an Owner reference"
    );
  }
  const matches = controlledArtifacts.artifactBindings.filter((binding) =>
    refsEqual(binding.artifactRef, asset)
  );
  if (
    matches.length !== 1 ||
    matches[0]!.blobSha256 !== asset.sha256 ||
    matches[0]!.byteLength !== asset.byteLength
  ) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      `A ${origin} Owner reference has no exact healthy controlled-artifact binding`
    );
  }
}

function cardFor(
  acquisition: ReferenceAssetAcquisition,
  asset: ReferenceDigitalAsset,
  classification: CardClassification,
  bindings: ReferenceAssetRoleBinding[],
  rightsAssertionCount: number,
  identityResolutions: readonly ReferenceAssetIdentityResolution[],
  opaqueProjector: OwnerReferenceWorkbenchOpaqueProjector
): OwnerReferenceWorkbenchSnapshot["references"][number] {
  const cardRef = opaqueProjector.project("card", { acquisition, asset });
  const acquisitionRef = opaqueProjector.project("acquisition", acquisition);
  const assetRef = opaqueProjector.project("asset", asset);
  const roleBindings = bindings.filter(
    (binding) =>
      refsEqual(binding.digitalAssetRef, acquisition.digitalAssetRef) &&
      binding.acquisitionRefs.some((reference) => refsEqual(reference, acquisition))
  );
  const ownerReferenceCount = roleBindings.filter(
    ({ recordKind }) => recordKind === "owner_reference_binding"
  ).length;
  const arrangementSourceCount = roleBindings.filter(
    ({ recordKind }) => recordKind === "arrangement_source_binding"
  ).length;
  const evaluationSourceCount = roleBindings.filter(
    ({ recordKind }) => recordKind === "evaluation_source_binding"
  ).length;
  const total = ownerReferenceCount + arrangementSourceCount + evaluationSourceCount;

  const currentIdentityResolutions = identityResolutions.filter(
    (resolution) =>
      !identityResolutions.some(
        (candidate) =>
          candidate.parentVersionRef !== undefined &&
          refsEqual(candidate.parentVersionRef, resolution)
      )
  );
  const identityState: "unresolved" | "candidate" | "reviewed" | "disputed" =
    currentIdentityResolutions.some(({ reviewState }) => reviewState === "disputed")
      ? "disputed"
      : currentIdentityResolutions.some(({ reviewState }) => reviewState === "reviewed")
        ? "reviewed"
        : currentIdentityResolutions.length > 0
          ? "candidate"
          : "unresolved";

  const identity: OwnerReferenceWorkbenchSnapshot["references"][number]["identity"] =
    identityState === "unresolved"
      ? {
          state: "unresolved",
          explanation:
            "No Work, manifestation, exemplar, date, edition, or specialist identity is asserted by this byte-level record.",
        }
      : {
          state: identityState,
          resolutionCount: currentIdentityResolutions.length,
          explanation:
            identityState === "candidate"
              ? "A source-identity candidate is staged for review. Its labels remain private and it grants no historical or specialist authority."
              : identityState === "reviewed"
                ? "A reviewed source-identity resolution is recorded for these exact bytes; it does not itself grant historical, specialist, access, or publication authority."
                : "Competing source-identity evidence is disputed. Vellum makes no automatic identity choice.",
        };

  return {
    id: cardRef.id,
    cardRef,
    acquisitionRef,
    assetRef,
    origin: classification.origin,
    migration: classification.migration,
    mediaType: asset.mediaType,
    byteLength: asset.byteLength,
    identity,
    rights: {
      state: rightsAssertionCount === 0 ? "unasserted" : "recorded",
      assertionCount: rightsAssertionCount,
      explanation:
        rightsAssertionCount === 0
          ? "No Rights Assertion is attached. Vellum infers no permission from possession or migration of these bytes."
          : "Rights Assertions are recorded for this exact acquisition, but permission still requires a separate operation-, destination-, and purpose-scoped Access Decision.",
    },
    roleBindings: {
      state: total === 0 ? "unbound" : "bound",
      ownerReferenceCount,
      arrangementSourceCount,
      evaluationSourceCount,
      explanation:
        total === 0
          ? "No role is active. Adding a role must preserve this exact acquisition and cannot borrow another role's authority."
          : "Role bindings preserve this exact acquisition; they do not grant historical, specialist, provider, export, or redistribution authority.",
    },
    access: ACCESS_EXPLANATIONS.map((entry) => ({ ...entry })),
    policyRef: PRIVATE_DEFAULT_POLICY_REF,
  };
}

function migrationExplanation(
  reference: OwnerReferenceMigrationCompatibilityView["ownerReferences"][number]
): string {
  if (reference.state === "mapped") {
    return "The exact legacy bytes are mapped into the source graph; bibliographic identity remains unresolved until reviewed.";
  }
  if (reference.state === "rolled_back") {
    return "The migration publication decision was rolled back; the existing byte-level graph record remains visible only for Owner review.";
  }
  return reference.quarantineReason
    ? `The byte-level migration is quarantined for ${reference.quarantineReason.replaceAll(
        "_",
        " "
      )}; it remains unavailable for authority-bearing use.`
    : "The byte-level migration is quarantined and remains unavailable for authority-bearing use.";
}

function coherenceReceipt(inputs: WorkbenchInputs): unknown {
  return {
    staging: {
      head: inputs.staging.head,
      snapshot: inputs.staging.snapshot
        ? {
            id: inputs.staging.snapshot.id,
            digest: inputs.staging.snapshot.digest,
            revision: inputs.staging.snapshot.revision,
          }
        : null,
      view: inputs.staging.view,
    },
    migration: {
      schemaVersion: inputs.migration.schemaVersion,
      publicationState: inputs.migration.publicationState,
      legacySourceState: inputs.migration.legacySourceState,
      ownerReferences: inputs.migration.ownerReferences,
      capabilities: inputs.migration.capabilities,
    },
    controlledArtifacts: inputs.controlledArtifacts,
  };
}

function assertCoherentStagingState(staging: ReferenceSourceStagingDiagnostics): void {
  if (!staging.head || !staging.snapshot) {
    if (staging.head === null && staging.snapshot === null) return;
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference Workbench staging head and snapshot are incomplete"
    );
  }
  if (
    staging.view.kind !== "current" ||
    staging.head.snapshotId !== staging.snapshot.id ||
    staging.head.digest !== staging.snapshot.digest ||
    staging.head.revision !== staging.snapshot.revision
  ) {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference Workbench staging head does not match its current snapshot"
    );
  }
  try {
    assertReferenceSourceStagingSnapshotIntegrity(staging.snapshot);
  } catch {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "The Owner-reference Workbench staging snapshot is not canonically valid"
    );
  }
}

function operationReviewResult(
  operation: OwnerReferenceWorkbenchLocalOperationReviewRequest["operation"],
  status: OwnerReferenceWorkbenchLocalOperationReviewResult["status"],
  reasonCode: OwnerReferenceWorkbenchLocalOperationReviewResult["reasonCode"]
): OwnerReferenceWorkbenchLocalOperationReviewResult {
  return Value.Decode(OwnerReferenceWorkbenchLocalOperationReviewResultSchema, {
    schemaVersion: 1,
    operation,
    status,
    reasonCode,
  });
}

const SEALED_LOCAL_REVIEW_EFFECTS: ReferenceSourceOperationEffects = Object.freeze({
  readControlledBytes: () => {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "A default Workbench review attempted to read controlled bytes"
    );
  },
  writeSink: () => {
    throw new OwnerReferenceWorkbenchIntegrityError(
      "A default Workbench review attempted to write a derivative"
    );
  },
});

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function fsyncDirectory(directory: string): void {
  const descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}

function isAssetAcquisition(
  record: ReferenceSourceStagingRecord
): record is ReferenceAssetAcquisition {
  return record.recordKind === "asset_acquisition";
}

function isRoleBinding(record: ReferenceSourceStagingRecord): record is ReferenceAssetRoleBinding {
  return (
    record.recordKind === "owner_reference_binding" ||
    record.recordKind === "arrangement_source_binding" ||
    record.recordKind === "evaluation_source_binding"
  );
}

function refKey(value: { id: string; digest: string }): string {
  return `${value.id}\u0000${value.digest}`;
}

function refFor(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refsEqual(left: { id: string; digest: string }, right: { id: string; digest: string }) {
  return left.id === right.id && left.digest === right.digest;
}

export class OwnerReferenceWorkbenchIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerReferenceWorkbenchIntegrityError";
  }
}
