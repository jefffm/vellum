import { createHash } from "node:crypto";

import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { Value } from "@sinclair/typebox/value";

import {
  ReferenceSourceStagingSnapshotSchema,
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceSourceStagingSnapshot,
} from "../../../src/lib/reference-source-domain.js";
import {
  OwnerReferenceWorkbenchLocalOperationReviewResultSchema,
  OwnerReferenceWorkbenchLocalStudyRequestSchema,
  OwnerReferenceWorkbenchSnapshotSchema,
  OwnerReferenceWorkbenchUploadConfirmationResultSchema,
  type OwnerReferenceWorkbenchLocalStudyRequest,
} from "../../../src/lib/owner-reference-workbench-contract.js";
import type { IngestOwnerReferenceSourceResult } from "../../../src/server/lib/reference-source-controlled-asset-service.js";
import type {
  OwnerReferenceMigrationCommitView,
  OwnerReferenceMigrationCompatibilityView,
  OwnerReferenceMigrationPlanView,
} from "../../../src/server/lib/owner-reference-migration-service.js";

const PRIVATE_FILENAME = "PRIVATE-FILENAME-CANARY.pdf";
const PRIVATE_RENAMED_FILENAME = "PRIVATE-RENAMED-FILENAME-CANARY.pdf";
const PRIVATE_BYTES = "%PDF-1.4\nPRIVATE-BYTES-CANARY\n";
const PRIVATE_RAW_SHA256 = createHash("sha256").update(PRIVATE_BYTES).digest("hex");
const PRIVATE_UPLOAD_HMAC_STORAGE_KEY = "vellum.owner-reference-upload-hmac-key.v1";
const PRIVATE_UPLOAD_PENDING_STORAGE_KEY = "vellum.owner-reference-upload-pending.v1";
const PRIVATE_LOCAL_STUDY_PENDING_STORAGE_KEY = "vellum.owner-reference-local-study-pending.v1";
const STAGING_PRIVATE_TITLE = "STAGING-PRIVATE-TITLE-CANARY";
const STAGING_PRIVATE_CITATION = "STAGING-PRIVATE-CITATION-CANARY";
const STAGING_PRIVATE_PATH = "/Users/owner/STAGING-PRIVATE-PATH-CANARY.pdf";
const STAGING_PRIVATE_RECORD_ID = "digital-asset.STAGING-PRIVATE-RECORD-ID-CANARY";
const STAGING_PRIVATE_ASSET = withReferenceRecordDigest({
  recordKind: "digital_asset" as const,
  id: STAGING_PRIVATE_RECORD_ID,
  sha256: PRIVATE_RAW_SHA256,
  mediaType: "application/pdf",
  byteLength: Buffer.byteLength(PRIVATE_BYTES),
});
const STAGING_PRIVATE_DIRECT_DIGEST = STAGING_PRIVATE_ASSET.digest;
const UPLOADED_PRIVATE_ASSET = withReferenceRecordDigest({
  recordKind: "digital_asset" as const,
  id: `digital-asset.sha256.${PRIVATE_RAW_SHA256}`,
  sha256: PRIVATE_RAW_SHA256,
  mediaType: "application/pdf",
  byteLength: Buffer.byteLength(PRIVATE_BYTES),
});
const STAGING_BASE_ACQUISITION = withReferenceRecordDigest({
  recordKind: "asset_acquisition" as const,
  id: "asset-acquisition.STAGING-PRIVATE-RECORD-ID-CANARY",
  digitalAssetRef: {
    id: STAGING_PRIVATE_ASSET.id,
    digest: STAGING_PRIVATE_ASSET.digest,
  },
  representedExemplarRefs: [],
  origin: {
    sourceKind: "upload" as const,
    ownerActionRef: {
      id: "owner-action.STAGING-PRIVATE-RECORD-ID-CANARY",
      digest: "e".repeat(64),
    },
  },
  acquiredAt: "2026-07-16T10:00:00.000Z",
  rightsAssertionRefs: [],
  processingPolicyRef: {
    id: "processing-policy.owner-local-reference-upload.v1",
    digest: "f".repeat(64),
  },
});
const STAGING_BASE_SNAPSHOT = privateStagingSnapshot(0);
const STAGING_HEAD_ID = STAGING_BASE_SNAPSHOT.id;
const STAGING_HEAD_DIGEST = STAGING_BASE_SNAPSHOT.digest;
const LEGACY_PRIVATE_RECORD_ID = "owner-reference.LEGACY-PRIVATE-RECORD-ID-CANARY";
const MIGRATION_PRIVATE_GENERATION_ID =
  "publication-generation.MIGRATION-PRIVATE-GENERATION-ID-CANARY";
const MIGRATION_PRIVATE_TRANSACTION_ID = "transaction.MIGRATION-PRIVATE-TRANSACTION-ID-CANARY";
const MIGRATION_PRIVATE_RECORD_ID =
  "owner-reference-migration-mapping.MIGRATION-PRIVATE-RECORD-ID-CANARY";
const MIGRATION_PRIVATE_DIGEST = "6".repeat(64);
const MIGRATION_PRIVATE_ORPHAN_ID = "publication-generation.MIGRATION-PRIVATE-ORPHAN-CANARY";
const MIGRATION_PRIVATE_ORPHAN_TRANSACTION_ID = "transaction.MIGRATION-PRIVATE-ORPHAN-CANARY";
const INITIAL_MIGRATION_HEAD = {
  generationId: "publication-generation.t10-browser",
  digest: "4".repeat(64),
  revision: 3,
};
const MOVED_MIGRATION_HEAD = {
  generationId: "publication-generation.t10-browser-moved",
  digest: "8".repeat(64),
  revision: 4,
};

test("Knowledge & defaults keeps migrated and uploaded Owner references private by default", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page);

  let library = await openOwnerReferenceLibrary(page);
  await expect(library).toContainText("Owner-private · staging only");
  await expect(library).toContainText("1 private reference · 1 migrated · 0 controlled uploads");
  const publication = page.locator("#vellum-owner-workbench .knowledge-publication-workbench");
  await expect(publication).toContainText("Current private migration publication");
  await expect(publication).toContainText("migration staging only");

  const migrated = library.locator(".owner-reference-library-card").first();
  await expect(migrated).toContainText("Migrated private reference");
  await expect(migrated).toContainText("Migration quarantined");
  await expect(migrated).toContainText("Bibliographic identity unresolved");
  await expect(migrated).toContainText("Rights unasserted · 0 assertions");
  await assertPrivateAccessDefaults(migrated);
  await migrated.getByLabel("Purpose for this review").fill("Study the exact local source");
  await migrated.getByRole("button", { name: "Review local processing" }).click();
  const migratedReviewStatus = migrated.locator(".owner-reference-library-local-review-status");
  await expect(migratedReviewStatus).toContainText("Review required · no private bytes were read");
  await expect(migratedReviewStatus).toContainText(
    "Next step: record an exact Owner Access Decision"
  );
  expect(fixture.reviewRequests[0]).toEqual({
    schemaVersion: 1,
    snapshotRef: ownerReferenceWorkbenchFixture(false).snapshotRef,
    cardRef: ownerReferenceWorkbenchFixture(false).references[0]!.cardRef,
    operation: "owner_private_study",
    purpose: "Study the exact local source",
  });
  await migrated.getByLabel("Local operation").selectOption("local_extraction");
  await migrated
    .getByLabel("Purpose for this review")
    .fill("STALE-SNAPSHOT-CANARY extract this exact local source");
  await migrated.getByRole("button", { name: "Review local processing" }).click();
  await expect(migratedReviewStatus).toContainText("changed while it was being reviewed");
  expect(fixture.reviewRequests[1]).toEqual({
    schemaVersion: 1,
    snapshotRef: ownerReferenceWorkbenchFixture(false).snapshotRef,
    cardRef: ownerReferenceWorkbenchFixture(false).references[0]!.cardRef,
    operation: "local_extraction",
    purpose: "STALE-SNAPSHOT-CANARY extract this exact local source",
  });
  await assertPrivateValuesRedacted(page);

  const upload = library.getByLabel("Private PDF or image");
  await upload.setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();

  await expect.poll(() => fixture.uploadRequest).not.toBeNull();
  assertControlledUpload(fixture.uploadRequest!, {
    expectedHeadId: STAGING_HEAD_ID,
    expectedHeadDigest: STAGING_HEAD_DIGEST,
    forbiddenFilenames: [PRIVATE_FILENAME],
  });
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
  await expect(library).toContainText("2 private references · 1 migrated · 1 controlled upload");
  const newlyUploaded = library.locator(".owner-reference-library-card").last();
  await expect(newlyUploaded).toContainText("New private upload");
  await expect(newlyUploaded).toContainText("Bibliographic identity unresolved");
  await expect(newlyUploaded).toContainText("Rights unasserted · 0 assertions");
  await assertPrivateAccessDefaults(newlyUploaded);
  await assertPrivateValuesRedacted(page);

  await page.reload();
  library = await openOwnerReferenceLibrary(page, false);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
  await expect(library).toContainText("2 private references · 1 migrated · 1 controlled upload");
  await expect(library.getByLabel("Private PDF or image")).toHaveValue("");
  await assertPrivateValuesRedacted(page);
});

test("Owner-attested local study previews migrated and uploaded PDFs without exposing private data", async ({
  page,
}) => {
  const browserLogs: string[] = [];
  page.on("console", (message) => browserLogs.push(message.text()));
  await installBlobUrlAudit(page);
  const fixture = await installOwnerReferenceLibraryFixture(page);
  let library = await openOwnerReferenceLibrary(page);
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);

  const migratedPurpose = "Compare the migrated source locally";
  let card = library.locator(".owner-reference-library-card").first();
  let authorization = await prepareLocalStudy(card, migratedPurpose);
  await expect(authorization.getByLabel("Attest to local private study only")).not.toBeChecked();
  await expect(
    authorization.getByRole("button", { name: "Open local private study preview" })
  ).toBeDisabled();
  await authorizeLocalStudy(page, authorization);

  let preview = page.locator(".owner-reference-local-study-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Byte-for-byte local study only");
  await expect(preview).not.toContainText("PRIVATE-BYTES-CANARY");
  await expect(preview.locator("a, [download]")).toHaveCount(0);
  await expect(preview.locator("iframe")).toHaveAttribute("src", /^blob:/);
  await preview.getByRole("button", { name: "Close private preview" }).click();
  await expect(preview).toHaveCount(0);
  await expect.poll(() => blobUrlAudit(page)).toEqual({ created: 1, revoked: 1 });

  library = page.locator("#vellum-owner-workbench .owner-reference-library-workbench");
  await expect(library.locator(".owner-reference-library-card").first()).toContainText(
    "Rights recorded · 1 assertion"
  );
  const uploadedPurpose = "Inspect the uploaded source locally";
  card = library.locator(".owner-reference-library-card").last();
  authorization = await prepareLocalStudy(card, uploadedPurpose);
  await authorizeLocalStudy(page, authorization);
  preview = page.locator(".owner-reference-local-study-preview");
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "Close private preview" }).click();
  await expect.poll(() => blobUrlAudit(page)).toEqual({ created: 2, revoked: 2 });

  expect(fixture.localStudyRequests).toHaveLength(2);
  expect(fixture.localStudyRequests[0]).toMatchObject({
    schemaVersion: 1,
    operation: "owner_private_study",
    authorization: "owner_attested_local_study",
    purpose: migratedPurpose,
  });
  expect(fixture.localStudyRequests[1]).toMatchObject({
    schemaVersion: 1,
    operation: "owner_private_study",
    authorization: "owner_attested_local_study",
    purpose: uploadedPurpose,
  });
  for (const request of fixture.localStudyRequests) {
    expect(request.operationKey).toMatch(/^owner-local-study\.v1\.[A-Za-z0-9_-]{21}[AQgw]$/);
  }
  const retryStorage = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    PRIVATE_LOCAL_STUDY_PENDING_STORAGE_KEY
  );
  expect(JSON.parse(retryStorage ?? "null")).toEqual({ schemaVersion: 1, intents: [] });
  const allStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(allStorage).not.toContain(migratedPurpose);
  expect(allStorage).not.toContain(uploadedPurpose);
  expect(browserLogs.join("\n")).not.toContain("PRIVATE-BYTES-CANARY");
  expect(browserLogs.join("\n")).not.toContain(PRIVATE_FILENAME);
  expect(browserLogs.join("\n")).not.toContain(PRIVATE_RAW_SHA256);
  await assertPrivateValuesRedacted(page);
});

test("local-study cancellation reads no bytes and local extraction stays in a future workflow", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page);
  const library = await openOwnerReferenceLibrary(page);
  const card = library.locator(".owner-reference-library-card").first();
  let authorization = await prepareLocalStudy(card, "Cancel this local preview");
  await authorization.getByLabel("Attest to local private study only").check();
  page.once("dialog", async (dialog) => dialog.dismiss());
  await authorization.getByRole("button", { name: "Open local private study preview" }).click();
  await expect(authorization.locator(".owner-reference-library-local-study-status")).toContainText(
    "cancelled"
  );
  expect(fixture.localStudyRequests).toHaveLength(0);
  expect(
    await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PRIVATE_LOCAL_STUDY_PENDING_STORAGE_KEY
    )
  ).toBeNull();

  await card.getByLabel("Local operation").selectOption("local_extraction");
  await card.getByLabel("Purpose for this review").fill("Extract evidence in a future workflow");
  await card.getByRole("button", { name: "Review local processing" }).click();
  await expect(card.locator(".owner-reference-library-local-review-status")).toContainText(
    "separately governed extraction workflow"
  );
  authorization = card.locator(".owner-reference-library-local-study-authorization");
  await expect(authorization).toBeHidden();
  expect(fixture.localStudyRequests).toHaveLength(0);
});

test("an uncertain committed local study replays the exact original scope and key after reload", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page, {
    localStudyOutcomes: ["uncertain_commit", "success"],
  });
  const purpose = "Retry this exact local study after uncertainty";
  let library = await openOwnerReferenceLibrary(page);
  let authorization = await prepareLocalStudy(
    library.locator(".owner-reference-library-card").first(),
    purpose
  );
  await authorizeLocalStudy(page, authorization);
  await expect(authorization.locator(".owner-reference-library-local-study-status")).toContainText(
    "outcome could not be confirmed"
  );
  await expect(page.locator(".owner-reference-local-study-preview")).toHaveCount(0);
  expect(fixture.localStudyRequests).toHaveLength(1);
  const first = structuredClone(fixture.localStudyRequests[0]!);

  await page.reload();
  library = await openOwnerReferenceLibrary(page, false);
  expect(ownerReferenceWorkbenchFixture(false).snapshotRef).not.toEqual(
    ownerReferenceWorkbenchFixture(false, [], { localStudyRevision: 1 }).snapshotRef
  );
  authorization = await prepareLocalStudy(
    library.locator(".owner-reference-library-card").first(),
    purpose
  );
  await authorizeLocalStudy(page, authorization);
  await expect(page.locator(".owner-reference-local-study-preview")).toBeVisible();
  expect(fixture.localStudyRequests).toHaveLength(2);
  expect(fixture.localStudyRequests[1]).toEqual(first);
  expect(fixture.localStudyRequests[1]!.snapshotRef).not.toEqual(
    ownerReferenceWorkbenchFixture(false, [], { localStudyRevision: 1 }).snapshotRef
  );
  const pending = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    PRIVATE_LOCAL_STUDY_PENDING_STORAGE_KEY
  );
  expect(JSON.parse(pending ?? "null")).toEqual({ schemaVersion: 1, intents: [] });
  await page
    .locator(".owner-reference-local-study-preview")
    .getByRole("button", { name: "Close private preview" })
    .click();
});

test("local-study conflicts and malformed binary responses fail closed with one retained key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page, {
    localStudyOutcomes: ["key_conflict", "malformed_binary", "success"],
  });
  const library = await openOwnerReferenceLibrary(page);
  const card = library.locator(".owner-reference-library-card").first();
  const authorization = await prepareLocalStudy(card, "Keep one key through safe failures");

  for (const expected of ["conflicts with a different server request", "not a valid, protected"]) {
    await authorizeLocalStudy(page, authorization);
    await expect(
      authorization.locator(".owner-reference-library-local-study-status")
    ).toContainText(expected);
    await expect(page.locator(".owner-reference-local-study-preview")).toHaveCount(0);
  }
  await authorizeLocalStudy(page, authorization);
  await expect(page.locator(".owner-reference-local-study-preview")).toBeVisible();
  expect(fixture.localStudyRequests).toHaveLength(3);
  expect(new Set(fixture.localStudyRequests.map(({ operationKey }) => operationKey)).size).toBe(1);
  expect(fixture.localStudyRequests[1]).toEqual(fixture.localStudyRequests[0]);
  expect(fixture.localStudyRequests[2]).toEqual(fixture.localStudyRequests[0]);
});

test("a proven precommit stale response refreshes and rebinds the same operation key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page, {
    localStudyOutcomes: ["stale_before_commit", "success"],
  });
  const purpose = "Rebind this local study after a proven stale snapshot";
  let library = await openOwnerReferenceLibrary(page);
  let authorization = await prepareLocalStudy(
    library.locator(".owner-reference-library-card").first(),
    purpose
  );
  await authorizeLocalStudy(page, authorization);
  await expect(page.locator("#vellum-owner-workbench")).toContainText(
    "refreshed after a proven pre-commit stale response"
  );

  library = page.locator("#vellum-owner-workbench .owner-reference-library-workbench");
  authorization = await prepareLocalStudy(
    library.locator(".owner-reference-library-card").first(),
    purpose
  );
  await authorizeLocalStudy(page, authorization);
  await expect(page.locator(".owner-reference-local-study-preview")).toBeVisible();
  expect(fixture.localStudyRequests).toHaveLength(2);
  expect(fixture.localStudyRequests[1]!.operationKey).toBe(
    fixture.localStudyRequests[0]!.operationKey
  );
  expect(fixture.localStudyRequests[1]!.snapshotRef).not.toEqual(
    fixture.localStudyRequests[0]!.snapshotRef
  );
  expect(fixture.localStudyRequests[1]!.cardRef).toEqual(fixture.localStudyRequests[0]!.cardRef);
});

test("a confirmed local study stays previewable when Workbench refresh fails and retires its key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceLibraryFixture(page, {
    failRefreshAfterLocalStudy: true,
  });
  const library = await openOwnerReferenceLibrary(page);
  const authorization = await prepareLocalStudy(
    library.locator(".owner-reference-library-card").first(),
    "Preview despite a failed post-authorization refresh"
  );
  await authorizeLocalStudy(page, authorization);
  const preview = page.locator(".owner-reference-local-study-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Workbench did not refresh");
  expect(fixture.localStudyRequests).toHaveLength(1);
  const pending = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    PRIVATE_LOCAL_STUDY_PENDING_STORAGE_KEY
  );
  expect(JSON.parse(pending ?? "null")).toEqual({ schemaVersion: 1, intents: [] });
});

test("a committed upload survives refresh failure and replays one acquisition after reload", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page);

  let library = await openOwnerReferenceLibrary(page);
  await expect(
    page.locator("#vellum-owner-workbench .reference-source-staging-private-summary")
  ).toContainText("2 staged records · 1 legacy compatibility record");
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();

  await expect.poll(() => fixture.uploadRequests.length).toBe(1);
  await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
  const firstKey = acquisitionKey(fixture.uploadRequests[0]!);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await assertPrivateValuesRedacted(page);

  await page.reload();
  library = await openOwnerReferenceLibrary(page, false);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
  await expect(library).toContainText("1 controlled upload");

  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_RENAMED_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();

  await expect.poll(() => fixture.uploadRequests.length).toBe(2);
  assertControlledUpload(fixture.uploadRequests[1]!, {
    expectedHeadId: privateStagingSnapshot(1).id,
    expectedHeadDigest: privateStagingSnapshot(1).digest,
    forbiddenFilenames: [PRIVATE_FILENAME, PRIVATE_RENAMED_FILENAME],
  });
  expect(acquisitionKey(fixture.uploadRequests[1]!)).toBe(firstKey);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
  await expect(library).toContainText("1 controlled upload");

  const clearedPending = await page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    PRIVATE_UPLOAD_PENDING_STORAGE_KEY
  );
  expect(JSON.parse(clearedPending ?? "null")).toEqual({ schemaVersion: 1, intents: [] });

  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_RENAMED_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();

  await expect.poll(() => fixture.uploadRequests.length).toBe(3);
  const laterIntentKey = acquisitionKey(fixture.uploadRequests[2]!);
  expect(laterIntentKey).not.toBe(firstKey);
  expect(fixture.acquisitionKeys.size).toBe(2);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(3);
  await expect(library).toContainText("2 controlled uploads");
  await assertPrivateValuesRedacted(page);
});

test("corrupt private retry state is recovered only through the Owner-confirmed UI", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page, { injectRefreshFailure: false });
  const library = await openOwnerReferenceLibrary(page);
  await page.evaluate(
    ({ storageKey }) => window.localStorage.setItem(storageKey, "CORRUPT-PRIVATE-HMAC-KEY-CANARY"),
    { storageKey: PRIVATE_UPLOAD_HMAC_STORAGE_KEY }
  );
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();

  await expect(library.getByRole("status")).toContainText("retry state is invalid");
  expect(fixture.uploadRequests).toHaveLength(0);
  const recovery = library.locator(".owner-reference-library-upload-recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("can create another acquisition");
  page.once("dialog", async (dialog) => dialog.accept());
  await recovery.getByRole("button", { name: "Recover private upload retry state" }).click();
  await expect(library.getByRole("status")).toContainText(
    "Browser-local retry identities were discarded"
  );

  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect.poll(() => fixture.uploadRequests.length).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
  await assertPrivateValuesRedacted(page);
});

test("ambiguous 422 and recovery-required 503 outcomes retain one acquisition key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page, {
    injectRefreshFailure: false,
    uploadFailures: ["unprocessable_content", "service_unavailable"],
  });
  const library = await openOwnerReferenceLibrary(page);
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });

  for (const requestCount of [1, 2]) {
    await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
    await expect.poll(() => fixture.uploadRequests.length).toBe(requestCount);
    await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
  }
  const retainedKey = acquisitionKey(fixture.uploadRequests[0]!);
  expect(acquisitionKey(fixture.uploadRequests[1]!)).toBe(retainedKey);

  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect.poll(() => fixture.uploadRequests.length).toBe(3);
  expect(acquisitionKey(fixture.uploadRequests[2]!)).toBe(retainedKey);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
});

test("malformed confirmation and a refreshed snapshot missing its card retain one key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page, {
    injectRefreshFailure: false,
    uploadConfirmationFaults: ["malformed", "missing_card"],
  });
  const library = await openOwnerReferenceLibrary(page);

  for (const requestCount of [1, 2, 3]) {
    await library.getByLabel("Private PDF or image").setInputFiles({
      name: PRIVATE_FILENAME,
      mimeType: "application/pdf",
      buffer: Buffer.from(PRIVATE_BYTES),
    });
    await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
    await expect.poll(() => fixture.uploadRequests.length).toBe(requestCount);
    if (requestCount < 3) {
      await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
    }
  }
  const retainedKey = acquisitionKey(fixture.uploadRequests[0]!);
  expect(fixture.uploadRequests.map(acquisitionKey)).toEqual([
    retainedKey,
    retainedKey,
    retainedKey,
  ]);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
});

test("stale upload confirmation snapshots and unrelated existing cards retain one key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page, {
    injectRefreshFailure: false,
    uploadConfirmationFaults: ["stale_snapshot", "wrong_existing_card"],
  });
  const library = await openOwnerReferenceLibrary(page);

  for (const requestCount of [1, 2, 3]) {
    await library.getByLabel("Private PDF or image").setInputFiles({
      name: PRIVATE_FILENAME,
      mimeType: "application/pdf",
      buffer: Buffer.from(PRIVATE_BYTES),
    });
    await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
    await expect.poll(() => fixture.uploadRequests.length).toBe(requestCount);
    if (requestCount < 3) {
      await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
    }
  }
  const retainedKey = acquisitionKey(fixture.uploadRequests[0]!);
  expect(fixture.uploadRequests.map(acquisitionKey)).toEqual([
    retainedKey,
    retainedKey,
    retainedKey,
  ]);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
});

test("malformed and mismatched upload 200 responses retain one acquisition key", async ({
  page,
}) => {
  const fixture = await installOwnerReferenceRetryFixture(page, {
    injectRefreshFailure: false,
    uploadResultFaults: ["malformed", "wrong_acquisition"],
  });
  const library = await openOwnerReferenceLibrary(page);

  for (const requestCount of [1, 2, 3]) {
    await library.getByLabel("Private PDF or image").setInputFiles({
      name: PRIVATE_FILENAME,
      mimeType: "application/pdf",
      buffer: Buffer.from(PRIVATE_BYTES),
    });
    await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
    await expect.poll(() => fixture.uploadRequests.length).toBe(requestCount);
    if (requestCount < 3) {
      await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
    }
  }
  const retainedKey = acquisitionKey(fixture.uploadRequests[0]!);
  expect(fixture.uploadRequests.map(acquisitionKey)).toEqual([
    retainedKey,
    retainedKey,
    retainedKey,
  ]);
  expect(fixture.acquisitionKeys.size).toBe(1);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
});

test("a 413 retains its intent until a positive confirmation", async ({ page }) => {
  const fixture = await installOwnerReferenceRetryFixture(page, {
    injectRefreshFailure: false,
    uploadFailures: ["request_too_large"],
  });
  const library = await openOwnerReferenceLibrary(page);
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(PRIVATE_BYTES),
  });

  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect.poll(() => fixture.uploadRequests.length).toBe(1);
  await expect(library.getByRole("status")).toContainText("outcome could not be confirmed");
  const rejectedKey = acquisitionKey(fixture.uploadRequests[0]!);

  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect.poll(() => fixture.uploadRequests.length).toBe(2);
  expect(acquisitionKey(fixture.uploadRequests[1]!)).toBe(rejectedKey);
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(2);
});

test("legacy migration requires a read-only review before an explicit staging commit", async ({
  page,
}) => {
  const fixture = await installLegacyMigrationFixture(page);
  const library = await openOwnerReferenceLibrary(page);
  const migration = library.locator("[data-owner-reference-migration-controls]");

  await expect(migration).toContainText("1 legacy private reference is waiting");
  await expect(migration.getByRole("button", { name: "Review migration plan" })).toBeVisible();
  await expect(
    migration.getByRole("button", { name: "Authorize private staging migration" })
  ).toBeHidden();
  expect(fixture.commitRequests).toBe(0);

  await migration.getByRole("button", { name: "Review migration plan" }).click();
  await expect(migration.getByRole("status")).toContainText(
    "Plan reviewed without writes: 1 byte mapping and 1 quarantine decision"
  );
  const plan = migration.locator("[data-owner-reference-migration-plan]");
  await expect(plan).toBeVisible();
  await expect(plan.locator("li")).toHaveCount(1);
  await expect(plan).toContainText("Private reference 1");
  await expect(plan).toContainText("exact bytes will be mapped into private staging");
  await expect(plan).toContainText("authority remains quarantined: incomplete identity");
  await expect(plan).toContainText("required action: review source identity");
  await expect(plan).not.toContainText(LEGACY_PRIVATE_RECORD_ID);
  await expect(
    migration.getByRole("button", { name: "Authorize private staging migration" })
  ).toBeVisible();
  expect(fixture.dryRunRequests).toBe(1);
  expect(fixture.commitRequests).toBe(0);
  expect(fixture.dryRunBodies[0]).toEqual({
    expectedHead: {
      id: INITIAL_MIGRATION_HEAD.generationId,
      digest: INITIAL_MIGRATION_HEAD.digest,
      revision: INITIAL_MIGRATION_HEAD.revision,
    },
  });

  await migration.getByRole("button", { name: "Authorize private staging migration" }).click();
  await expect.poll(() => fixture.commitRequests).toBe(1);
  expect(fixture.commitBodies[0]).toEqual({
    expectedHead: {
      id: INITIAL_MIGRATION_HEAD.generationId,
      digest: INITIAL_MIGRATION_HEAD.digest,
      revision: INITIAL_MIGRATION_HEAD.revision,
    },
    planDigest: "5".repeat(64),
  });
  await expect(migration.getByRole("status")).toContainText(
    "review the refreshed state before any retry"
  );
  await expect(
    migration.getByRole("button", { name: "Authorize private staging migration" })
  ).toBeHidden();

  await migration.getByRole("button", { name: "Review migration plan" }).click();
  await expect(migration.getByRole("status")).toContainText("Plan reviewed without writes");
  await expect.poll(() => fixture.dryRunRequests).toBe(2);
  expect(fixture.dryRunBodies[1]).toEqual({
    expectedHead: {
      id: MOVED_MIGRATION_HEAD.generationId,
      digest: MOVED_MIGRATION_HEAD.digest,
      revision: MOVED_MIGRATION_HEAD.revision,
    },
  });
  await migration.getByRole("button", { name: "Authorize private staging migration" }).click();
  await expect.poll(() => fixture.commitRequests).toBe(2);
  expect(fixture.commitBodies[1]).toEqual({
    expectedHead: {
      id: MOVED_MIGRATION_HEAD.generationId,
      digest: MOVED_MIGRATION_HEAD.digest,
      revision: MOVED_MIGRATION_HEAD.revision,
    },
    planDigest: "9".repeat(64),
  });
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(1);
  await expect(library).toContainText("Migrated private reference");
  await expect(library).toContainText("Migration quarantined");
  await expect(library).toContainText("Rights unasserted · 0 assertions");
  await assertPrivateValuesRedacted(page);
});

test("migration authorization rejects false capabilities and duplicate mapping identities", async ({
  page,
}) => {
  const fixture = await installLegacyMigrationFixture(page, {
    injectHeadConflict: false,
    planFaults: ["activation", "duplicate_mapping"],
  });
  const library = await openOwnerReferenceLibrary(page);
  const migration = library.locator("[data-owner-reference-migration-controls]");

  for (const expectedDryRuns of [1, 2]) {
    await migration.getByRole("button", { name: "Review migration plan" }).click();
    await expect.poll(() => fixture.dryRunRequests).toBe(expectedDryRuns);
    await expect(migration.getByRole("status")).toContainText(
      "migration plan could not be validated"
    );
    await expect(
      migration.getByRole("button", { name: "Authorize private staging migration" })
    ).toBeHidden();
  }
  expect(fixture.commitRequests).toBe(0);
  await assertPrivateValuesRedacted(page);
});

type LocalStudyFixtureOutcome =
  | "success"
  | "uncertain_commit"
  | "key_conflict"
  | "malformed_binary"
  | "stale_before_commit";

async function installOwnerReferenceLibraryFixture(
  page: Page,
  options: {
    localStudyOutcomes?: LocalStudyFixtureOutcome[];
    failRefreshAfterLocalStudy?: boolean;
  } = {}
): Promise<{
  uploadRequest: Request | null;
  reviewRequests: unknown[];
  localStudyRequests: OwnerReferenceWorkbenchLocalStudyRequest[];
}> {
  const localStudyOutcomes = [...(options.localStudyOutcomes ?? [])];
  const fixture: {
    uploaded: boolean;
    uploadRequest: Request | null;
    reviewRequests: unknown[];
    localStudyRequests: OwnerReferenceWorkbenchLocalStudyRequest[];
    localStudyRevision: number;
    studiedCardRefIds: Set<string>;
    committedLocalStudyKeys: Set<string>;
    failNextOwnerRefresh: boolean;
  } = {
    uploaded: false,
    uploadRequest: null,
    reviewRequests: [],
    localStudyRequests: [],
    localStudyRevision: 0,
    studiedCardRefIds: new Set(),
    committedLocalStudyKeys: new Set(),
    failNextOwnerRefresh: false,
  };

  await page.route("**/api/owner", async (route) => {
    if (fixture.failNextOwnerRefresh) {
      fixture.failNextOwnerRefresh = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: failure(503, "service_unavailable", "Injected post-study refresh failure."),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success({
        personalDefaultCandidates: [],
        personalDefaults: [],
        ownerReferences: [],
        knowledgeCandidates: [],
        historicalPracticeClaims: [],
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(privateStagingDiagnostics(fixture.uploaded ? 1 : 0)),
    });
  });
  await page.route("**/api/owner/reference-source-workbench", async (route) => {
    const uploadKeys = fixture.uploadRequest ? [acquisitionKey(fixture.uploadRequest)] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        Value.Decode(
          OwnerReferenceWorkbenchSnapshotSchema,
          ownerReferenceWorkbenchFixture(fixture.uploaded, uploadKeys, {
            localStudyRevision: fixture.localStudyRevision,
            studiedCardRefIds: fixture.studiedCardRefIds,
          })
        )
      ),
    });
  });
  await page.route("**/api/owner/reference-source-workbench/upload-confirmation", async (route) => {
    const request = route.request().postDataJSON() as { acquisitionKey: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        ownerReferenceUploadConfirmation(1, [request.acquisitionKey], {
          localStudyRevision: fixture.localStudyRevision,
          studiedCardRefIds: fixture.studiedCardRefIds,
        })
      ),
    });
  });
  await page.route(
    "**/api/owner/reference-source-workbench/local-operation-review",
    async (route) => {
      const request = route.request().postDataJSON() as {
        operation: "owner_private_study" | "local_extraction";
        purpose: string;
      };
      fixture.reviewRequests.push(request);
      const stale = request.purpose.includes("STALE-SNAPSHOT-CANARY");
      const result = Value.Decode(OwnerReferenceWorkbenchLocalOperationReviewResultSchema, {
        schemaVersion: 1,
        operation: request.operation,
        status: stale ? "deny" : "review_required",
        reasonCode: stale ? "workbench_snapshot_stale" : "owner_private_local_review_required",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: success(result),
      });
    }
  );
  await page.route("**/api/owner/reference-source-workbench/local-study", async (route) => {
    const request = Value.Decode(
      OwnerReferenceWorkbenchLocalStudyRequestSchema,
      route.request().postDataJSON()
    );
    fixture.localStudyRequests.push(request);
    const outcome = localStudyOutcomes.shift() ?? "success";
    if (outcome === "key_conflict") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: localStudyConflictFailure(
          "operation_key_bound_to_different_scope",
          "reuse_exact_request"
        ),
      });
      return;
    }
    if (outcome === "stale_before_commit") {
      fixture.localStudyRevision += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: localStudyConflictFailure(
          "workbench_snapshot_stale_before_commit",
          "refresh_and_rebind_same_operation_key"
        ),
      });
      return;
    }
    if (outcome === "malformed_binary") {
      await route.fulfill({
        status: 200,
        headers: protectedLocalStudyHeaders("application/json", 2),
        body: "{}",
      });
      return;
    }

    const firstCommit = !fixture.committedLocalStudyKeys.has(request.operationKey);
    if (firstCommit) {
      fixture.committedLocalStudyKeys.add(request.operationKey);
      fixture.studiedCardRefIds.add(request.cardRef.id);
      fixture.localStudyRevision += 1;
    }
    if (outcome === "uncertain_commit") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: failure(503, "service_unavailable", "Injected uncertain committed study."),
      });
      return;
    }
    if (options.failRefreshAfterLocalStudy) fixture.failNextOwnerRefresh = true;
    await route.fulfill({
      status: 200,
      headers: protectedLocalStudyHeaders("application/pdf", Buffer.byteLength(PRIVATE_BYTES)),
      body: Buffer.from(PRIVATE_BYTES),
    });
  });
  await page.route("**/api/owner/reference-source-staging/assets", async (route) => {
    fixture.uploadRequest = route.request();
    fixture.uploaded = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(controlledUploadResult(route.request(), 1, false)),
    });
  });
  await page.route("**/api/owner/reference-migrations/owner-references", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(migrationCompatibility("quarantined")),
    });
  });
  await page.route("**/api/owner/knowledge-publication**", async (route) => {
    await fulfillPrivateMigrationPublication(route);
  });

  return fixture;
}

async function installOwnerReferenceRetryFixture(
  page: Page,
  options: {
    injectRefreshFailure?: boolean;
    uploadFailures?: Array<"request_too_large" | "unprocessable_content" | "service_unavailable">;
    uploadResultFaults?: Array<"malformed" | "wrong_acquisition">;
    uploadConfirmationFaults?: Array<
      "malformed" | "missing_card" | "stale_snapshot" | "wrong_existing_card"
    >;
  } = {}
): Promise<{
  uploadRequests: Request[];
  acquisitionKeys: Set<string>;
}> {
  const uploadFailures = [...(options.uploadFailures ?? [])];
  const uploadResultFaults = [...(options.uploadResultFaults ?? [])];
  const uploadConfirmationFaults = [...(options.uploadConfirmationFaults ?? [])];
  const fixture = {
    uploadRequests: [] as Request[],
    acquisitionKeys: new Set<string>(),
    committedAcquisitionKeys: new Set<string>(),
    failNextOwnerRefresh: false,
    refreshFailureInjected: false,
    omitNextConfirmedCard: false,
  };

  await page.route("**/api/owner", async (route) => {
    if (fixture.failNextOwnerRefresh) {
      fixture.failNextOwnerRefresh = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: failure(503, "service_unavailable", "Injected post-commit refresh failure."),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(emptyOwnerState()),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(privateStagingDiagnostics(fixture.committedAcquisitionKeys.size)),
    });
  });
  await page.route("**/api/owner/reference-source-workbench", async (route) => {
    const uploadKeys = [...fixture.committedAcquisitionKeys];
    const uploadCount = fixture.omitNextConfirmedCard
      ? Math.max(0, fixture.committedAcquisitionKeys.size - 1)
      : fixture.committedAcquisitionKeys.size;
    fixture.omitNextConfirmedCard = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        Value.Decode(
          OwnerReferenceWorkbenchSnapshotSchema,
          ownerReferenceWorkbenchFixture(uploadCount, uploadKeys.slice(0, uploadCount))
        )
      ),
    });
  });
  await page.route("**/api/owner/reference-source-workbench/upload-confirmation", async (route) => {
    const fault = uploadConfirmationFaults.shift();
    if (fault === "missing_card") fixture.omitNextConfirmedCard = true;
    const uploadKeys = [...fixture.committedAcquisitionKeys];
    const confirmation = ownerReferenceUploadConfirmation(
      fixture.committedAcquisitionKeys.size,
      uploadKeys
    );
    const migratedCard = ownerReferenceWorkbenchFixture(
      fixture.committedAcquisitionKeys.size,
      uploadKeys
    ).references[0]!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        fault === "malformed"
          ? { schemaVersion: 1, status: "present" }
          : fault === "stale_snapshot"
            ? {
                ...confirmation,
                snapshotRef: ownerReferenceWorkbenchFixture(
                  Math.max(0, fixture.committedAcquisitionKeys.size - 1),
                  uploadKeys.slice(0, -1)
                ).snapshotRef,
              }
            : fault === "wrong_existing_card"
              ? { ...confirmation, cardRef: migratedCard.cardRef }
              : confirmation
      ),
    });
  });
  await page.route("**/api/owner/reference-source-staging/assets", async (route) => {
    const request = route.request();
    fixture.uploadRequests.push(request);
    const key = acquisitionKey(request);
    const replayed = fixture.committedAcquisitionKeys.has(key);
    fixture.acquisitionKeys.add(key);
    const injectedFailure = uploadFailures.shift();
    if (injectedFailure) {
      if (injectedFailure !== "request_too_large") fixture.committedAcquisitionKeys.add(key);
      const status =
        injectedFailure === "request_too_large"
          ? 413
          : injectedFailure === "unprocessable_content"
            ? 422
            : 503;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: failure(
          status,
          injectedFailure,
          "Injected upload outcome for retry classification.",
          injectedFailure === "service_unavailable"
            ? { outcome: "unknown", retrySafety: "reuse_acquisition_key_after_restart" }
            : undefined
        ),
      });
      return;
    }
    fixture.committedAcquisitionKeys.add(key);
    if ((options.injectRefreshFailure ?? true) && !fixture.refreshFailureInjected) {
      fixture.refreshFailureInjected = true;
      fixture.failNextOwnerRefresh = true;
    }
    const result = controlledUploadResult(request, fixture.committedAcquisitionKeys.size, replayed);
    const resultFault = uploadResultFaults.shift();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        resultFault === "malformed"
          ? { schemaVersion: 1, publicationState: "staging_only" }
          : resultFault === "wrong_acquisition"
            ? {
                ...result,
                acquisition: {
                  ...result.acquisition,
                  id: "acquisition.owner-upload.WRONG-ACQUISITION-CANARY",
                },
              }
            : result
      ),
    });
  });
  await page.route("**/api/owner/reference-migrations/owner-references", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(migrationCompatibility("quarantined")),
    });
  });
  await page.route("**/api/owner/knowledge-publication**", async (route) => {
    await fulfillPrivateMigrationPublication(route);
  });

  return fixture;
}

async function installLegacyMigrationFixture(
  page: Page,
  options: {
    injectHeadConflict?: boolean;
    planFaults?: Array<"activation" | "duplicate_mapping">;
  } = {}
): Promise<{
  dryRunRequests: number;
  commitRequests: number;
  dryRunBodies: unknown[];
  commitBodies: unknown[];
}> {
  const planFaults = [...(options.planFaults ?? [])];
  const fixture = {
    committed: false,
    dryRunRequests: 0,
    commitRequests: 0,
    dryRunBodies: [] as unknown[],
    commitBodies: [] as unknown[],
    conflictInjected: false,
    currentHead: { ...INITIAL_MIGRATION_HEAD },
  };

  await page.route("**/api/owner", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success({
        personalDefaultCandidates: [],
        personalDefaults: [],
        ownerReferences: [],
        knowledgeCandidates: [],
        historicalPracticeClaims: [],
      }),
    });
  });
  await page.route("**/api/owner/reference-source-staging", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(privateStagingDiagnostics()),
    });
  });
  await page.route("**/api/owner/reference-source-workbench", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        Value.Decode(OwnerReferenceWorkbenchSnapshotSchema, {
          ...ownerReferenceWorkbenchFixture(false),
          references: fixture.committed ? [ownerReferenceCard("migrated", "migrated")] : [],
        })
      ),
    });
  });
  await page.route("**/api/owner/reference-migrations/owner-references/dry-run", async (route) => {
    fixture.dryRunRequests += 1;
    const body = route.request().postDataJSON() as {
      expectedHead: OwnerReferenceMigrationPlanView["expectedHead"];
    };
    fixture.dryRunBodies.push(body);
    const planDigest = fixture.dryRunRequests === 1 ? "5".repeat(64) : "9".repeat(64);
    const plan: OwnerReferenceMigrationPlanView = {
      schemaVersion: 1,
      mode: "dry_run",
      planDigest,
      expectedHead: body.expectedHead,
      expectedGraphHead: null,
      writesPerformed: false,
      mappings: [
        {
          legacyId: LEGACY_PRIVATE_RECORD_ID,
          bibliographicIdentity: "not_asserted",
          alreadyMapped: false,
        },
      ],
      quarantines: [
        {
          legacyId: LEGACY_PRIVATE_RECORD_ID,
          reason: "incomplete_identity",
          action: "review_source_identity",
        },
      ],
      capabilities: migrationCapabilities(),
    };
    const fault = planFaults.shift();
    const response =
      fault === "activation"
        ? { ...plan, capabilities: { ...plan.capabilities, activation: true } }
        : fault === "duplicate_mapping"
          ? { ...plan, mappings: [...plan.mappings, plan.mappings[0]!] }
          : plan;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(response),
    });
  });
  await page.route("**/api/owner/reference-migrations/owner-references/commit", async (route) => {
    fixture.commitRequests += 1;
    const body = route.request().postDataJSON() as {
      expectedHead: OwnerReferenceMigrationPlanView["expectedHead"];
      planDigest: string;
    };
    fixture.commitBodies.push(body);
    if ((options.injectHeadConflict ?? true) && !fixture.conflictInjected) {
      fixture.conflictInjected = true;
      fixture.currentHead = { ...MOVED_MIGRATION_HEAD };
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: failure(409, "conflict", "Injected publication-head movement."),
      });
      return;
    }
    fixture.committed = true;
    fixture.currentHead = {
      generationId: "publication-generation.t10-browser-committed",
      digest: "a".repeat(64),
      revision: fixture.currentHead.revision + 1,
    };
    const result: OwnerReferenceMigrationCommitView = {
      schemaVersion: 1,
      mode: "commit",
      planDigest: body.planDigest,
      batchId: "owner-reference-migration-batch.t10-browser",
      outcome: "committed",
      journalState: "committed",
      mappedCount: 1,
      quarantineCount: 1,
      head: fixture.currentHead,
      capabilities: migrationCapabilities(),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(result),
    });
  });
  await page.route("**/api/owner/reference-migrations/owner-references", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: success(
        migrationCompatibility(fixture.committed ? "quarantined" : "pending", fixture.currentHead)
      ),
    });
  });
  await page.route("**/api/owner/knowledge-publication**", async (route) => {
    await fulfillPrivateMigrationPublication(route);
  });

  return fixture;
}

async function openOwnerReferenceLibrary(page: Page, navigate = true) {
  if (navigate) await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const launcher = page.getByRole("button", { name: "Knowledge & defaults" });
  await expect(launcher).toBeVisible();
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
    await expect(guidedStart).not.toBeVisible();
  }
  await launcher.click();
  const dialog = page.locator("#vellum-owner-workbench");
  await expect(dialog).toBeVisible();
  const library = dialog.locator(".owner-reference-library-workbench");
  await expect(library.getByRole("heading", { name: "Owner Reference Library" })).toBeVisible();
  return library;
}

async function prepareLocalStudy(card: Locator, purpose: string): Promise<Locator> {
  const access = card.locator(".owner-reference-library-access");
  if (!(await access.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await access.getByText("Review private access defaults", { exact: true }).click();
  }
  await card.getByLabel("Local operation").selectOption("owner_private_study");
  await card.getByLabel("Purpose for this review").fill(purpose);
  await card.getByRole("button", { name: "Review local processing" }).click();
  const authorization = card.locator(".owner-reference-library-local-study-authorization");
  await expect(authorization).toBeVisible();
  await expect(authorization).toContainText("does not authorize extraction");
  return authorization;
}

async function authorizeLocalStudy(page: Page, authorization: Locator): Promise<void> {
  await authorization.getByLabel("Attest to local private study only").check();
  page.once("dialog", async (dialog) => dialog.accept());
  await authorization.getByRole("button", { name: "Open local private study preview" }).click();
}

async function installBlobUrlAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const state = { created: 0, revoked: 0 };
    Object.defineProperty(window, "__vellumT10BlobUrlAudit", {
      configurable: false,
      enumerable: false,
      value: state,
      writable: false,
    });
    URL.createObjectURL = (blob: Blob) => {
      state.created += 1;
      return originalCreate(blob);
    };
    URL.revokeObjectURL = (url: string) => {
      state.revoked += 1;
      originalRevoke(url);
    };
  });
}

async function blobUrlAudit(page: Page): Promise<{ created: number; revoked: number }> {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __vellumT10BlobUrlAudit: { created: number; revoked: number };
        }
      ).__vellumT10BlobUrlAudit
  );
}

async function assertPrivateAccessDefaults(card: Locator): Promise<void> {
  await card.getByText("Review private access defaults", { exact: true }).click();
  for (const [operation, status] of [
    ["local study", "review required"],
    ["local extraction", "review required"],
    ["provider egress", "deny"],
    ["fixture inclusion", "deny"],
    ["repository inclusion", "deny"],
    ["export", "deny"],
    ["redistribution", "deny"],
    ["report", "deny"],
    ["log", "deny"],
  ] as const) {
    await expect(card).toContainText(new RegExp(`${operation} · ${status}`, "i"));
  }
}

function assertControlledUpload(
  request: Request,
  options: { expectedHeadId: string; expectedHeadDigest: string; forbiddenFilenames: string[] }
): void {
  const headers = request.headers();
  const requestText = [
    request.url(),
    JSON.stringify(headers),
    request.postDataBuffer()?.toString("utf8") ?? "",
  ].join("\n");

  expect(request.method()).toBe("POST");
  expect(headers["content-type"]).toBe("application/pdf");
  expect(headers["x-reference-acquisition-key"]).toBeTruthy();
  expect(headers["x-reference-expected-head-id"]).toBe(options.expectedHeadId);
  expect(headers["x-reference-expected-head-digest"]).toBe(options.expectedHeadDigest);
  expect(request.postDataBuffer()?.toString("utf8")).toBe(PRIVATE_BYTES);
  for (const filename of options.forbiddenFilenames) expect(requestText).not.toContain(filename);
  expect(requestText).not.toContain(PRIVATE_RAW_SHA256);
}

function acquisitionKey(request: Request): string {
  const value = request.headers()["x-reference-acquisition-key"];
  expect(value).toMatch(/^owner-upload\.v2\.[A-Za-z0-9_-]{43}$/);
  return value!;
}

async function assertPrivateValuesRedacted(page: Page): Promise<void> {
  const dialog = page.locator("#vellum-owner-workbench");
  await expect(dialog).not.toContainText(PRIVATE_FILENAME);
  await expect(dialog).not.toContainText("PRIVATE-BYTES-CANARY");
  await expect(dialog).not.toContainText("asset-acquisition.t10-private");
  await expect(dialog).not.toContainText("digital-asset.t10-private");
  await expect(dialog).not.toContainText("a".repeat(64));
  await expect(dialog).not.toContainText("b".repeat(64));
  await expect(dialog).not.toContainText(PRIVATE_RENAMED_FILENAME);
  await expect(dialog).not.toContainText(STAGING_PRIVATE_TITLE);
  await expect(dialog).not.toContainText(STAGING_PRIVATE_CITATION);
  await expect(dialog).not.toContainText(STAGING_PRIVATE_PATH);
  await expect(dialog).not.toContainText(STAGING_PRIVATE_RECORD_ID);
  await expect(dialog).not.toContainText(STAGING_PRIVATE_DIRECT_DIGEST);
  await expect(dialog).not.toContainText(LEGACY_PRIVATE_RECORD_ID);
  const serialized = await dialog.evaluate((element) => element.outerHTML);
  for (const canary of [
    PRIVATE_FILENAME,
    PRIVATE_RENAMED_FILENAME,
    "PRIVATE-BYTES-CANARY",
    STAGING_HEAD_ID,
    STAGING_PRIVATE_TITLE,
    STAGING_PRIVATE_CITATION,
    STAGING_PRIVATE_PATH,
    STAGING_PRIVATE_RECORD_ID,
    LEGACY_PRIVATE_RECORD_ID,
    MIGRATION_PRIVATE_GENERATION_ID,
    MIGRATION_PRIVATE_TRANSACTION_ID,
    MIGRATION_PRIVATE_RECORD_ID,
    MIGRATION_PRIVATE_DIGEST,
    MIGRATION_PRIVATE_ORPHAN_ID,
    MIGRATION_PRIVATE_ORPHAN_TRANSACTION_ID,
    "asset-acquisition.STAGING-PRIVATE-RECORD-ID-CANARY",
    "owner-action.STAGING-PRIVATE-RECORD-ID-CANARY",
    "asset-acquisition.t10-private",
    "digital-asset.t10-private",
    STAGING_HEAD_DIGEST,
    STAGING_HEAD_DIGEST.slice(0, 12),
    STAGING_PRIVATE_DIRECT_DIGEST,
    STAGING_PRIVATE_DIRECT_DIGEST.slice(0, 12),
    "a".repeat(64),
    "a".repeat(12),
    "b".repeat(64),
    "b".repeat(12),
    "d".repeat(64),
    "d".repeat(12),
    PRIVATE_RAW_SHA256,
    PRIVATE_RAW_SHA256.slice(0, 12),
  ]) {
    expect(serialized).not.toContain(canary);
  }
}

async function fulfillPrivateMigrationPublication(route: Route): Promise<void> {
  const record = {
    recordKind: "owner_reference_migration_mapping",
    id: MIGRATION_PRIVATE_RECORD_ID,
    digest: MIGRATION_PRIVATE_DIGEST,
  };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: success({
      current: {
        head: {
          generationId: MIGRATION_PRIVATE_GENERATION_ID,
          digest: MIGRATION_PRIVATE_DIGEST,
          revision: 1,
        },
        generation: {
          schemaVersion: 1,
          id: MIGRATION_PRIVATE_GENERATION_ID,
          revision: 1,
          transactionId: MIGRATION_PRIVATE_TRANSACTION_ID,
          writerKind: "migration",
          createdAt: "2026-07-16T10:00:00.000Z",
          requestDigest: "7".repeat(64),
          recordRefs: [record],
          newRecordRefs: [record],
          digest: MIGRATION_PRIVATE_DIGEST,
        },
        records: [{ schemaVersion: 1, ...record, successorRefs: [] }],
      },
      orphans: [
        {
          generationId: MIGRATION_PRIVATE_ORPHAN_ID,
          displayRef: {
            id: "private-display.publication-orphan.t10-browser",
            digest: createHash("sha256").update("publication-orphan:t10-browser").digest("hex"),
          },
          state: "complete_staging",
          transactionId: MIGRATION_PRIVATE_ORPHAN_TRANSACTION_ID,
          revision: 2,
          parentGenerationRef: {
            id: MIGRATION_PRIVATE_GENERATION_ID,
            digest: MIGRATION_PRIVATE_DIGEST,
            revision: 1,
          },
          stagedRecordCount: 1,
        },
      ],
    }),
  });
}

function emptyOwnerState() {
  return {
    personalDefaultCandidates: [],
    personalDefaults: [],
    ownerReferences: [],
    knowledgeCandidates: [],
    historicalPracticeClaims: [],
  };
}

function privateStagingSnapshot(uploadCount = 0): ReferenceSourceStagingSnapshot {
  const additionalAcquisitions = Array.from({ length: uploadCount }, (_, index) =>
    withReferenceRecordDigest({
      recordKind: "asset_acquisition" as const,
      id: `acquisition.owner-upload.t10-fixture-${index + 1}`,
      digitalAssetRef: {
        id: STAGING_PRIVATE_ASSET.id,
        digest: STAGING_PRIVATE_ASSET.digest,
      },
      representedExemplarRefs: [],
      origin: {
        sourceKind: "upload" as const,
        ownerActionRef: {
          id: `owner-action.t10-fixture-${index + 1}`,
          digest: createHash("sha256")
            .update(`owner-action:${index + 1}`)
            .digest("hex"),
        },
      },
      acquiredAt: `2026-07-16T10:00:${String(index + 1).padStart(2, "0")}.000Z`,
      rightsAssertionRefs: [],
      processingPolicyRef: {
        id: "processing-policy.owner-local-reference-upload.v1",
        digest: "f".repeat(64),
      },
    })
  );
  const records = [STAGING_PRIVATE_ASSET, STAGING_BASE_ACQUISITION, ...additionalAcquisitions];
  const revision = 7 + uploadCount;
  const createdAt = `2026-07-16T10:01:${String(uploadCount).padStart(2, "0")}.000Z`;
  const core: Omit<ReferenceSourceStagingSnapshot, "digest"> = {
    schemaVersion: 1,
    id: `reference-source-snapshot.t10-browser-${uploadCount}`,
    revision,
    publicationState: "staging_only",
    createdAt,
    recordObservations: records.map((record) => ({
      recordRef: { id: record.id, digest: record.digest },
      firstObservedRevision: revision,
      observedAt: createdAt,
      orderingTrust: "server_observed" as const,
    })),
    records: records as ReferenceSourceStagingSnapshot["records"],
  };
  return Value.Decode(ReferenceSourceStagingSnapshotSchema, {
    ...core,
    digest: referenceSourceDigest(core),
  });
}

function privateLegacyProjection() {
  return {
    ownerReferences: [
      {
        id: LEGACY_PRIVATE_RECORD_ID,
        title: STAGING_PRIVATE_TITLE,
        citation: STAGING_PRIVATE_CITATION,
        mimeType: "application/pdf",
        sha256: PRIVATE_RAW_SHA256,
        byteLength: Buffer.byteLength(PRIVATE_BYTES),
        createdAt: "2026-07-16T10:00:00.000Z",
        readOnly: true as const,
        identityConfidence: { kind: "unknown" as const },
      },
    ],
  };
}

function ownerReferenceWorkbenchFixture(
  uploadCountOrIncluded: number | boolean,
  uploadKeys: readonly string[] = [],
  localStudy: {
    localStudyRevision?: number;
    studiedCardRefIds?: ReadonlySet<string>;
  } = {}
) {
  const uploadCount =
    typeof uploadCountOrIncluded === "boolean"
      ? uploadCountOrIncluded
        ? 1
        : 0
      : uploadCountOrIncluded;
  const snapshotDigest = createHash("sha256")
    .update(
      `owner-reference-workbench-fixture:${uploadCount}:${localStudy.localStudyRevision ?? 0}`
    )
    .digest("hex");
  const references = [
    ownerReferenceCard("migrated", "migrated"),
    ...Array.from({ length: uploadCount }, (_, index) =>
      ownerReferenceCard("upload", `uploaded-${index + 1}`, uploadKeys[index])
    ),
  ].map((card) =>
    localStudy.studiedCardRefIds?.has(card.cardRef.id)
      ? {
          ...card,
          rights: {
            state: "recorded" as const,
            assertionCount: 1,
            explanation: "One local-study Rights Assertion is recorded for this exact acquisition.",
          },
        }
      : card
  );
  return {
    schemaVersion: 1 as const,
    snapshotRef: {
      id: `owner-reference-workbench-snapshot.upload-count-${uploadCount}.study-${localStudy.localStudyRevision ?? 0}`,
      digest: snapshotDigest,
    },
    references,
  };
}

function ownerReferenceUploadConfirmation(
  uploadCount: number,
  uploadKeys: readonly string[],
  localStudy: {
    localStudyRevision?: number;
    studiedCardRefIds?: ReadonlySet<string>;
  } = {}
) {
  const snapshot = Value.Decode(
    OwnerReferenceWorkbenchSnapshotSchema,
    ownerReferenceWorkbenchFixture(uploadCount, uploadKeys, localStudy)
  );
  const card = [...snapshot.references].reverse().find(({ origin }) => origin === "upload");
  if (!card) throw new Error("Upload confirmation fixture requires one uploaded card");
  return Value.Decode(OwnerReferenceWorkbenchUploadConfirmationResultSchema, {
    schemaVersion: 1,
    status: "present",
    snapshotRef: snapshot.snapshotRef,
    cardRef: card.cardRef,
  });
}

function ownerReferenceCard(origin: "migrated" | "upload", suffix: string, uploadKey?: string) {
  const opaqueDigest = createHash("sha256").update(`card:${suffix}`).digest("hex");
  const acquisitionProjectionSeed = uploadKey
    ? `private-projection:${uploadKey}`
    : `private-projection:${suffix}`;
  const projectedAcquisitionId = createHash("sha256")
    .update(`id:${acquisitionProjectionSeed}`)
    .digest("hex");
  const projectedAcquisitionDigest = createHash("sha256")
    .update(`digest:${acquisitionProjectionSeed}`)
    .digest("hex");
  return {
    id: `owner-reference-card.${suffix}`,
    cardRef: {
      id: `owner-reference-card-ref.t10-private-${suffix}`,
      digest: opaqueDigest,
    },
    acquisitionRef: {
      id: `private-acquisition.${projectedAcquisitionId.slice(0, 32)}`,
      digest: projectedAcquisitionDigest,
    },
    assetRef: {
      id: `digital-asset.t10-private-${suffix}`,
      digest: "b".repeat(64),
    },
    origin,
    migration:
      origin === "migrated"
        ? {
            state: "quarantined" as const,
            legacySourceState: "verified" as const,
            quarantineReason: "incomplete_identity" as const,
            explanation:
              "The immutable byte mapping is stable while bibliographic identity remains under review.",
          }
        : null,
    mediaType: "application/pdf",
    byteLength: 4096,
    identity: {
      state: "unresolved" as const,
      explanation: "No Work, edition, or historical identity has been asserted.",
    },
    rights: {
      state: "unasserted" as const,
      assertionCount: 0,
      explanation: "No permission is inferred from possession or migration of these bytes.",
    },
    roleBindings: {
      state: "unbound" as const,
      ownerReferenceCount: 0,
      arrangementSourceCount: 0,
      evaluationSourceCount: 0,
      explanation: "No source role is active and no activation authority is implied.",
    },
    access: [
      access("local_study", "review_required"),
      access("local_extraction", "review_required"),
      access("provider_egress", "deny"),
      access("fixture_inclusion", "deny"),
      access("repository_inclusion", "deny"),
      access("export", "deny"),
      access("redistribution", "deny"),
      access("report", "deny"),
      access("log", "deny"),
    ],
    policyRef: { id: "policy.owner-reference-private-defaults.v1", digest: "f".repeat(64) },
  };
}

function access(
  operation:
    | "local_study"
    | "local_extraction"
    | "provider_egress"
    | "fixture_inclusion"
    | "repository_inclusion"
    | "export"
    | "redistribution"
    | "report"
    | "log",
  status: "deny" | "review_required"
) {
  return { operation, status, explanation: `${operation} is ${status} under the private default.` };
}

function migrationCapabilities() {
  return { compatibilityReads: true, canonicalWriter: false, activation: false };
}

function privateStagingDiagnostics(uploadCount = 0) {
  const snapshot = privateStagingSnapshot(uploadCount);
  return {
    publicationState: "staging_only" as const,
    view: { kind: "current" as const },
    head: {
      snapshotId: snapshot.id,
      digest: snapshot.digest,
      revision: snapshot.revision,
    },
    snapshot,
    legacyProjection: privateLegacyProjection(),
    capabilities: { stagingTransactions: true as const, canonicalPublication: false as const },
  };
}

function migrationCompatibility(
  state: "pending" | "quarantined",
  head: OwnerReferenceMigrationCompatibilityView["head"] = null
): OwnerReferenceMigrationCompatibilityView {
  return {
    schemaVersion: 1,
    publicationState: "migration_only",
    head,
    legacySourceState: "verified",
    ownerReferences: [
      {
        legacyId: LEGACY_PRIVATE_RECORD_ID,
        state,
        legacySourceState: "verified",
        ...(state === "quarantined"
          ? {
              mappingId: MIGRATION_PRIVATE_RECORD_ID,
              quarantineReason: "incomplete_identity" as const,
            }
          : {}),
      },
    ],
    capabilities: migrationCapabilities(),
  };
}

function controlledUploadResult(
  request: Request,
  uploadCount: number,
  replayed: boolean
): IngestOwnerReferenceSourceResult {
  const key = acquisitionKey(request);
  const acquisition = controlledUploadAcquisition(key);
  const snapshot = privateStagingSnapshot(uploadCount);
  return {
    schemaVersion: 1,
    publicationState: "staging_only",
    replayed,
    digitalAsset: UPLOADED_PRIVATE_ASSET as ReferenceDigitalAsset,
    acquisition,
    head: {
      snapshotId: snapshot.id,
      digest: snapshot.digest,
      revision: snapshot.revision,
    },
  };
}

function controlledUploadAcquisition(key: string): ReferenceAssetAcquisition {
  const keyDigest = createHash("sha256").update(key).digest("hex");
  return withReferenceRecordDigest({
    recordKind: "asset_acquisition" as const,
    id: `acquisition.owner-upload.${keyDigest.slice(0, 32)}`,
    digitalAssetRef: {
      id: UPLOADED_PRIVATE_ASSET.id,
      digest: UPLOADED_PRIVATE_ASSET.digest,
    },
    representedExemplarRefs: [],
    origin: {
      sourceKind: "upload" as const,
      ownerActionRef: {
        id: `owner-action.reference-upload.${keyDigest.slice(0, 32)}`,
        digest: createHash("sha256").update(`owner-action:${keyDigest}`).digest("hex"),
      },
    },
    acquiredAt: "2026-07-16T10:02:00.000Z",
    rightsAssertionRefs: [],
    processingPolicyRef: {
      id: "processing-policy.owner-local-reference-upload.v1",
      digest: "f".repeat(64),
    },
  }) as ReferenceAssetAcquisition;
}

function failure(
  status: number,
  code: "conflict" | "request_too_large" | "unprocessable_content" | "service_unavailable",
  message: string,
  details?: Record<string, unknown>
): string {
  return JSON.stringify({
    ok: false,
    error: {
      code,
      message,
      status,
      correlationId: `t10-browser-${code}`,
      ...(details ? { details } : {}),
    },
  });
}

function localStudyConflictFailure(
  reason: "operation_key_bound_to_different_scope" | "workbench_snapshot_stale_before_commit",
  retrySafety: "reuse_exact_request" | "refresh_and_rebind_same_operation_key"
): string {
  return JSON.stringify({
    ok: false,
    error: {
      code: "conflict",
      message: "The bounded local-study request could not proceed.",
      status: 409,
      correlationId: "t10-browser-local-study-conflict",
      details: { reason, retrySafety },
    },
  });
}

function protectedLocalStudyHeaders(mediaType: string, byteLength: number): Record<string, string> {
  return {
    "Content-Type": mediaType,
    "Content-Length": String(byteLength),
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
}

function success(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
