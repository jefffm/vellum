import { createHash } from "node:crypto";

import {
  withReferenceRecordDigest,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceSourceStagingInputRecord,
  type ReferenceSourceStagingTransaction,
} from "../../lib/reference-source-domain.js";
import type {
  ReferenceSourceControlledArtifactBinding,
  ReleaseReferenceSourceControlledArtifactInput,
} from "./reference-source-controlled-artifact-store.js";
import {
  ReferenceSourceStagingService,
  type ReferenceSourceStagingDiagnostics,
} from "./reference-source-staging-service.js";
import { ReferenceSourceStagingConflictError } from "./reference-source-staging-store.js";

const OWNER_UPLOAD_PROCESSING_POLICY_REF = externalRef(
  "processing-policy.owner-local-reference-upload.v1"
);
const ACQUISITION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

/**
 * Narrow structural contract used so ingestion cannot call the generic
 * caller-supplied artifact binding API. The concrete store validates the full
 * Digital Asset record, its digest, declared byte identity, and the bytes.
 */
export type ReferenceSourceDigitalAssetStore = {
  putDigitalAsset(input: { digitalAsset: ReferenceDigitalAsset; bytes: Uint8Array }): {
    binding: ReferenceSourceControlledArtifactBinding;
    created: boolean;
  };
  release(input: ReleaseReferenceSourceControlledArtifactInput): unknown;
};

export type IngestOwnerReferenceSourceInput = {
  bytes: Uint8Array;
  declaredMediaType: string;
  acquisitionKey: string;
  expectedHeadRef?: ReferenceRecordRef;
};

export type IngestOwnerReferenceSourceResult = {
  schemaVersion: 1;
  publicationState: "staging_only";
  replayed: boolean;
  digitalAsset: ReferenceDigitalAsset;
  acquisition: ReferenceAssetAcquisition;
  head: NonNullable<ReferenceSourceStagingDiagnostics["head"]>;
};

export type ReferenceSourceControlledAssetIngestionServiceOptions = {
  stagingService: ReferenceSourceStagingService;
  controlledStore: ReferenceSourceDigitalAssetStore;
  now?: () => Date;
};

/**
 * Owner-local byte ingestion for the noncanonical Reference Source staging graph.
 *
 * The server derives byte identity and immutable record identity. A caller can
 * choose only an opaque retry key and an exact compare-and-swap head. The same
 * key replays the original acquisition; a different key creates a distinct
 * acquisition edge even when the bytes deduplicate to the same Digital Asset.
 */
export class ReferenceSourceControlledAssetIngestionService {
  private readonly stagingService: ReferenceSourceStagingService;
  private readonly controlledStore: ReferenceSourceDigitalAssetStore;
  private readonly now: () => Date;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: ReferenceSourceControlledAssetIngestionServiceOptions) {
    this.stagingService = options.stagingService;
    this.controlledStore = options.controlledStore;
    this.now = options.now ?? (() => new Date());
  }

  ingest(input: IngestOwnerReferenceSourceInput): Promise<IngestOwnerReferenceSourceResult> {
    const operation = this.queue.then(
      () => this.ingestSerialized(input),
      () => this.ingestSerialized(input)
    );
    this.queue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  private ingestSerialized(
    input: IngestOwnerReferenceSourceInput
  ): IngestOwnerReferenceSourceResult {
    if (!ACQUISITION_KEY_PATTERN.test(input.acquisitionKey)) {
      throw new ReferenceSourceControlledAssetIngestionIntegrityError(
        "Owner reference acquisition key is invalid"
      );
    }
    const bytes = Buffer.from(input.bytes);
    if (bytes.byteLength === 0) {
      throw new ReferenceSourceControlledAssetIngestionIntegrityError(
        "Owner reference source bytes cannot be empty"
      );
    }
    const mediaType = assertDetectedMediaType(bytes, input.declaredMediaType);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const current = this.stagingService.readCurrent();
    const records = current.snapshot?.records ?? [];
    const keyDigest = createHash("sha256").update(input.acquisitionKey).digest("hex");
    const expectedAsset = digitalAssetFor({ sha256, mediaType, byteLength: bytes.byteLength });
    const existingAsset = records.find(
      (record): record is ReferenceDigitalAsset =>
        record.recordKind === "digital_asset" && record.sha256 === sha256
    );
    const digitalAsset = existingAsset ?? expectedAsset;
    if (
      existingAsset &&
      (existingAsset.mediaType !== mediaType || existingAsset.byteLength !== bytes.byteLength)
    ) {
      throw new ReferenceSourceControlledAssetIngestionConflictError(
        "The staged Digital Asset identity conflicts with the uploaded bytes"
      );
    }

    const acquisitionId = `acquisition.owner-upload.${keyDigest.slice(0, 32)}`;
    const existingWithId = records.find((record) => record.id === acquisitionId);
    if (existingWithId) {
      if (
        existingWithId.recordKind !== "asset_acquisition" ||
        !refsEqual(existingWithId.digitalAssetRef, refFor(digitalAsset)) ||
        existingWithId.origin.sourceKind !== "upload" ||
        !refsEqual(existingWithId.origin.ownerActionRef, ownerActionRefFor(keyDigest)) ||
        !refsEqual(existingWithId.processingPolicyRef, OWNER_UPLOAD_PROCESSING_POLICY_REF) ||
        existingWithId.representedExemplarRefs.length !== 0 ||
        existingWithId.rightsAssertionRefs.length !== 0 ||
        existingWithId.supersedesAcquisitionRef !== undefined
      ) {
        throw new ReferenceSourceControlledAssetIngestionConflictError(
          "Owner reference acquisition key was already used for a different acquisition"
        );
      }
      this.controlledStore.putDigitalAsset({ digitalAsset, bytes });
      if (!current.head) {
        throw new ReferenceSourceControlledAssetIngestionIntegrityError(
          "A staged acquisition exists without a staging head"
        );
      }
      return {
        schemaVersion: 1,
        publicationState: "staging_only",
        replayed: true,
        digitalAsset,
        acquisition: existingWithId,
        head: current.head,
      };
    }

    assertExpectedHead(current.head, input.expectedHeadRef);
    const acquiredAt = this.now().toISOString();
    const acquisition = withReferenceRecordDigest({
      recordKind: "asset_acquisition" as const,
      id: acquisitionId,
      digitalAssetRef: refFor(digitalAsset),
      representedExemplarRefs: [],
      origin: {
        sourceKind: "upload" as const,
        ownerActionRef: ownerActionRefFor(keyDigest),
      },
      acquiredAt,
      rightsAssertionRefs: [],
      processingPolicyRef: OWNER_UPLOAD_PROCESSING_POLICY_REF,
    }) as ReferenceAssetAcquisition;
    const appended: ReferenceSourceStagingInputRecord[] = [
      ...(existingAsset ? [] : [digitalAsset]),
      acquisition,
    ];
    const transaction: ReferenceSourceStagingTransaction = {
      schemaVersion: 1,
      id: `transaction.owner-upload.${acquisition.digest.slice(0, 32)}`,
      ...(input.expectedHeadRef ? { expectedHeadRef: input.expectedHeadRef } : {}),
      operations: appended.map((record) => ({ type: "append_record" as const, record })),
      submittedAt: acquiredAt,
    };

    const put = this.controlledStore.putDigitalAsset({ digitalAsset, bytes });
    let committed: ReferenceSourceStagingDiagnostics;
    try {
      committed = this.stagingService.applyTransaction(transaction);
    } catch (error) {
      this.rollbackNewUnreferencedBinding({
        error,
        putCreated: put.created,
        assetWasStaged: existingAsset !== undefined,
        digitalAsset,
        priorHead: current.head,
      });
      throw error;
    }
    if (!committed.head) {
      throw new ReferenceSourceControlledAssetIngestionIntegrityError(
        "Owner reference ingestion committed without a staging head"
      );
    }
    return {
      schemaVersion: 1,
      publicationState: "staging_only",
      replayed: false,
      digitalAsset,
      acquisition,
      head: committed.head,
    };
  }

  private rollbackNewUnreferencedBinding(input: {
    error: unknown;
    putCreated: boolean;
    assetWasStaged: boolean;
    digitalAsset: ReferenceDigitalAsset;
    priorHead: ReferenceSourceStagingDiagnostics["head"];
  }): void {
    if (!input.putCreated || input.assetWasStaged) return;
    const currentHead = this.stagingService.readCurrent().head;
    if (!sameHead(currentHead, input.priorHead)) return;
    try {
      this.controlledStore.release({
        artifactRef: refFor(input.digitalAsset),
        expectedBlobSha256: input.digitalAsset.sha256,
      });
    } catch (rollbackError) {
      throw new ReferenceSourceControlledAssetIngestionRecoveryRequiredError(
        "Owner reference metadata did not commit and its new controlled-store binding could not be rolled back; inventory will remain blocked until recovery",
        { cause: rollbackError, ingestionError: input.error }
      );
    }
  }
}

export class ReferenceSourceControlledAssetIngestionIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceControlledAssetIngestionIntegrityError";
  }
}

export class ReferenceSourceControlledAssetIngestionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceSourceControlledAssetIngestionConflictError";
  }
}

export class ReferenceSourceControlledAssetIngestionRecoveryRequiredError extends Error {
  readonly ingestionError: unknown;

  constructor(message: string, options: { cause: unknown; ingestionError: unknown }) {
    super(message, { cause: options.cause });
    this.name = "ReferenceSourceControlledAssetIngestionRecoveryRequiredError";
    this.ingestionError = options.ingestionError;
  }
}

function digitalAssetFor(input: {
  sha256: string;
  mediaType: string;
  byteLength: number;
}): ReferenceDigitalAsset {
  return withReferenceRecordDigest({
    recordKind: "digital_asset" as const,
    id: `digital-asset.sha256.${input.sha256}`,
    sha256: input.sha256,
    mediaType: input.mediaType,
    byteLength: input.byteLength,
  }) as ReferenceDigitalAsset;
}

function assertDetectedMediaType(bytes: Buffer, declared: string): string {
  const normalized = declared.split(";", 1)[0]!.trim().toLowerCase();
  const canonical = normalized === "image/jpg" ? "image/jpeg" : normalized;
  const detected = detectMediaType(bytes);
  if (!detected) {
    throw new ReferenceSourceControlledAssetIngestionIntegrityError(
      "Owner reference source media type is unsupported or could not be detected"
    );
  }
  if (canonical !== detected) {
    throw new ReferenceSourceControlledAssetIngestionIntegrityError(
      `Owner reference source declared ${canonical || "no media type"} but detected ${detected}`
    );
  }
  return detected;
}

function detectMediaType(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 1024).indexOf(Buffer.from("%PDF-")) >= 0) return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    bytes.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return "image/tiff";
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function assertExpectedHead(
  actual: ReferenceSourceStagingDiagnostics["head"],
  expected?: ReferenceRecordRef
): void {
  if (
    (!actual && expected === undefined) ||
    (actual && expected && actual.snapshotId === expected.id && actual.digest === expected.digest)
  ) {
    return;
  }
  throw new ReferenceSourceStagingConflictError(
    "Reference-source staging head changed before owner reference ingestion",
    actual
  );
}

function sameHead(
  left: ReferenceSourceStagingDiagnostics["head"],
  right: ReferenceSourceStagingDiagnostics["head"]
): boolean {
  if (!left || !right) return left === null && right === null;
  return (
    left.snapshotId === right.snapshotId &&
    left.digest === right.digest &&
    left.revision === right.revision
  );
}

function ownerActionRefFor(keyDigest: string): ReferenceRecordRef {
  return externalRef(`owner-action.reference-upload.${keyDigest.slice(0, 32)}`);
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: withReferenceRecordDigest({ id }).digest };
}

function refFor(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function refsEqual(left: ReferenceRecordRef, right: ReferenceRecordRef): boolean {
  return left.id === right.id && left.digest === right.digest;
}
