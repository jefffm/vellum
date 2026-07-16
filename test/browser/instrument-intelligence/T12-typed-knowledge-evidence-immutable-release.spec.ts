import { createHash, createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityVerificationReceipt,
} from "../../../src/lib/reference-source-authority.js";
import { buildKnowledgeSystemIdentitySnapshot } from "../../../src/lib/reviewed-knowledge-contract.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
} from "../../../src/lib/reference-source-domain.js";
import { createApp } from "../../../src/server/index.js";
import { KnowledgePublicationStore } from "../../../src/server/lib/knowledge-publication-store.js";
import { PopplerReferencePageAtlasParser } from "../../../src/server/lib/reference-page-atlas-parser.js";
import {
  ExactAssetReferencePageAtlasSourceProfileResolver,
  defineMacePageAtlasSourceProfile,
} from "../../../src/server/lib/reference-page-atlas-source-profile.js";
import { ReferenceSourceControlledArtifactStore } from "../../../src/server/lib/reference-source-controlled-artifact-store.js";
import { ReferenceSourceStagingService } from "../../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../../src/server/lib/reference-source-staging-store.js";
import type {
  TypedKnowledgePackCitationAuthorityProvider,
  TypedKnowledgePackCitationAuthorityRequest,
  TypedKnowledgeSystemIdentityProvider,
} from "../../../src/server/lib/typed-knowledge-release-service.js";
import {
  startRealBrowserAppProxy,
  type RealBrowserAppProxy,
} from "../../support/real-browser-app-proxy.js";
import { buildSyntheticPagedPdf } from "../../support/synthetic-paged-pdf.js";

test.setTimeout(90_000);

const PRIVATE_FILENAME = "PRIVATE-T12-MACE-SOURCE.pdf";
const PRIVATE_SOURCE_CANARY = "PRIVATE-T12-SOURCE-CANARY";
const EXACT_PURPOSE = "Stage the exact Mace citation for a typed test-only release";
const AUTHORITY_TEST_SECRET = "vellum-t12-browser-authority-test-secret";
const TEST_SYSTEM_IDENTITY_PROVIDER: TypedKnowledgeSystemIdentityProvider = {
  resolveSystemIdentity: () =>
    buildKnowledgeSystemIdentitySnapshot({
      recordKind: "knowledge_system_identity_snapshot",
      schemaVersion: 1,
      id: "system-identity.vellum.typed-release.playwright-t12",
      systemKind: "vellum_server",
      buildRef: externalRef("build.vellum.playwright.t12.fixture"),
      environmentRef: externalRef("environment.vellum.playwright.node-chrome"),
    }),
};

test("a real PDF crosses Page Atlas into an immutable test-only release with no activation path", async ({
  page,
  baseURL,
}) => {
  const bytes = buildSyntheticPagedPdf({
    pageCount: 3,
    citedPage: 2,
    citedText: `Synthetic T12 source: a /a //a ///a 4 5 ${PRIVATE_SOURCE_CANARY}`,
  });
  const authorityRequests: TypedKnowledgePackCitationAuthorityRequest[] = [];
  const harness = await startHarness(baseURL, bytes, authorityRequests);
  const typedRequests: unknown[] = [];
  const browserLogs: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => browserLogs.push(message.text()));
  page.on("pageerror", (error) => {
    const diagnostic = error.stack ?? error.message;
    pageErrors.push(diagnostic);
    browserLogs.push(`pageerror: ${diagnostic}`);
  });
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname ===
        "/api/owner/reference-source-workbench/typed-knowledge-release" &&
      request.method() === "POST"
    ) {
      typedRequests.push(request.postDataJSON());
    }
  });

  try {
    await enterRealApp(page, harness.proxy.origin);
    try {
      await expect(page.getByRole("button", { name: "Knowledge & defaults" })).toBeVisible({
        timeout: 10_000,
      });
    } catch {
      throw new Error(`The real frontend did not initialize: ${browserLogs.join(" | ")}`);
    }
    await uploadPrivateReference(page, bytes);
    let workbench = await openPageAtlas(page);
    await workbench.getByLabel("Extraction profile").selectOption("mace-musicks-monument-1676");
    await workbench.getByLabel("Exact local purpose").fill(EXACT_PURPOSE);
    await workbench.getByLabel("Attest to local extraction only").check();
    page.once("dialog", (dialog) => dialog.accept());
    await workbench.getByRole("button", { name: "Start local extraction" }).click();

    const release = workbench.locator(".typed-knowledge-release-workbench");
    await expect(release).toBeVisible();
    await expect(release).toContainText("No human or historical authority is granted");
    await expect(release).toContainText("default activation remains denied");
    await expect(release.getByRole("button", { name: /Publish/ })).toHaveCount(0);

    const previewResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await release.getByRole("button", { name: "Preview typed knowledge release" }).click();
    expect((await previewResponse).status()).toBe(200);
    await expect(release).toContainText("Candidate");
    await expect(release).toContainText("Draft");
    await expect(release).toContainText("Immutable release");
    await expect(release).toContainText("Course 13 remains unresolved");
    await expect(release).toContainText("Not evaluated");
    await expect(release).toContainText("Not issued");
    await expect(release).toContainText(harness.initialPublicationHead.id);
    await expect(
      page.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();

    expect(typedRequests).toHaveLength(1);
    expect(typedRequests[0]).toMatchObject({
      schemaVersion: 1,
      action: "preview",
      selection: {
        workbenchSnapshotRef: expect.any(Object),
        workbenchCardRef: expect.any(Object),
        operationRef: expect.any(Object),
        expectedProjectionRef: expect.any(Object),
        candidateRef: expect.any(Object),
      },
    });
    expect(Object.keys(typedRequests[0] as object).sort()).toEqual([
      "action",
      "schemaVersion",
      "selection",
    ]);
    expect(Object.keys((typedRequests[0] as { selection: object }).selection).sort()).toEqual([
      "candidateRef",
      "expectedProjectionRef",
      "operationRef",
      "workbenchCardRef",
      "workbenchSnapshotRef",
    ]);

    const concurrentHead = advanceUnrelatedPublication(harness.publicationStore, "concurrent");
    const conflictResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await release
      .getByRole("button", { name: "Publish immutable test-only knowledge release" })
      .click();
    expect((await conflictResponse).status()).toBe(409);
    await expect(release).toContainText("Publication was not confirmed");
    await expect(release.getByRole("button", { name: /Publish/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();

    expect(typedRequests[1]).toMatchObject({
      schemaVersion: 1,
      action: "publish",
      expectedPublicationHead: harness.initialPublicationHead,
      selection: (typedRequests[0] as { selection: unknown }).selection,
    });
    expect(Object.keys(typedRequests[1] as object).sort()).toEqual([
      "action",
      "expectedPublicationHead",
      "schemaVersion",
      "selection",
    ]);

    const refreshedPreviewResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await release.getByRole("button", { name: "Preview typed knowledge release" }).click();
    const refreshedPreview = await refreshedPreviewResponse;
    const refreshedPreviewBody = await refreshedPreview.json();
    if (refreshedPreview.status() !== 200) {
      throw new Error(
        `Refreshed preview returned ${refreshedPreview.status()}: ${JSON.stringify(refreshedPreviewBody)}`
      );
    }
    expect(refreshedPreviewBody).toMatchObject({ ok: true });
    await expect(release.getByRole("button", { name: /Publish/ })).toHaveCount(1);
    await expect(release).toContainText(concurrentHead.id);
    await expect(
      page.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();

    let droppedPublishStatus: number | undefined;
    let droppedPublishBody: unknown;
    await page.route(
      "**/api/owner/reference-source-workbench/typed-knowledge-release",
      async (route) => {
        const response = await route.fetch();
        droppedPublishStatus = response.status();
        droppedPublishBody = await response.json();
        await route.abort("failed");
      },
      { times: 1 }
    );
    await release
      .getByRole("button", { name: "Publish immutable test-only knowledge release" })
      .click();
    await expect(release).toContainText("Publication was not confirmed");
    expect(droppedPublishStatus).toBe(200);
    expect(droppedPublishBody).toMatchObject({
      ok: true,
      data: { publicationOutcome: "publish_committed" },
    });
    await expect(release.getByRole("button", { name: /Publish/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();

    expect(typedRequests[2]).toMatchObject({
      schemaVersion: 1,
      action: "preview",
      selection: (typedRequests[0] as { selection: unknown }).selection,
    });
    expect(typedRequests[3]).toMatchObject({
      schemaVersion: 1,
      action: "publish",
      expectedPublicationHead: concurrentHead,
      selection: (typedRequests[0] as { selection: unknown }).selection,
    });

    const recoveryPreviewResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await release.getByRole("button", { name: "Preview typed knowledge release" }).click();
    const recovered = await recoveryPreviewResponse;
    expect(recovered.status()).toBe(200);
    expect(await recovered.json()).toMatchObject({
      ok: true,
      data: { publicationOutcome: "preview_existing" },
    });
    await expect(release).toContainText("existing immutable test-only release was found");
    await expect(release).toContainText("Issued test-only");
    await expect(release).toContainText("Verified for this publication");
    await expect(release).toContainText("Denied · no activation decision exists");
    await expect(release.locator(".typed-knowledge-release-status")).not.toContainText(
      "release published"
    );
    await expect(
      page.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();

    expect(JSON.stringify(typedRequests)).not.toContain("authority");
    expect(JSON.stringify(typedRequests)).not.toContain(PRIVATE_FILENAME);
    expect(JSON.stringify(typedRequests)).not.toContain(PRIVATE_SOURCE_CANARY);

    expect(authorityRequests).toHaveLength(1);
    expect(authorityRequests[0]).toMatchObject({
      operation: "pack_citation",
      destination: { kind: "repository", id: "vellum.reviewed-knowledge-library" },
    });
    const snapshot = harness.publicationStore.readCurrent();
    expect(snapshot).not.toBeNull();
    const recordKinds = snapshot!.records.map(({ recordKind }) => recordKind);
    for (const kind of [
      "knowledge_applicability_predicate",
      "knowledge_candidate",
      "knowledge_evidence_edge",
      "knowledge_constraint_derivation",
      "knowledge_component_binding",
      "knowledge_component_mapping",
      "knowledge_profile",
      "knowledge_pack_draft",
      "knowledge_pack_release",
      "knowledge_system_identity_snapshot",
      "knowledge_test_policy",
      "release_attestation",
    ]) {
      expect(recordKinds).toContain(kind);
    }
    expect(recordKinds).not.toContain("activation_decision");
    const releaseRecord = snapshot!.records.find(
      ({ recordKind }) => recordKind === "knowledge_pack_release"
    );
    const attestation = snapshot!.records.find(
      ({ recordKind }) => recordKind === "release_attestation"
    );
    expect(releaseRecord).toBeDefined();
    expect(attestation).toBeDefined();
    const immutableReleaseBytes = JSON.stringify(releaseRecord);

    await page.reload({ waitUntil: "domcontentloaded" });
    workbench = await openPageAtlas(page);
    const reloadedRelease = workbench.locator(".typed-knowledge-release-workbench");
    await expect(reloadedRelease).toBeVisible();
    const reloadedPreviewResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await reloadedRelease.getByRole("button", { name: "Preview typed knowledge release" }).click();
    expect(await (await reloadedPreviewResponse).json()).toMatchObject({
      ok: true,
      data: { publicationOutcome: "preview_existing" },
    });
    await expect(reloadedRelease).toContainText("Issued test-only");
    await expect(reloadedRelease).toContainText("Denied · no activation decision exists");
    expect(
      JSON.stringify(
        harness.publicationStore
          .readCurrent()!
          .records.find(({ recordKind }) => recordKind === "knowledge_pack_release")
      )
    ).toBe(immutableReleaseBytes);
    expect(authorityRequests).toHaveLength(1);
    expect(pageErrors).toEqual([]);

    const browserSurface = `${await page.locator("body").innerText()}\n${browserLogs.join("\n")}\n${JSON.stringify(await page.evaluate(() => localStorage))}`;
    expect(browserSurface).not.toContain(PRIVATE_FILENAME);
    expect(browserSurface).not.toContain(PRIVATE_SOURCE_CANARY);
    expect(browserSurface).not.toContain(createHash("sha256").update(bytes).digest("hex"));
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await harness.close();
  }
});

test("the production boundary discloses missing publication prerequisites without offering Publish", async ({
  page,
  baseURL,
}) => {
  const bytes = buildSyntheticPagedPdf({
    pageCount: 3,
    citedPage: 2,
    citedText: "Synthetic T12 unavailable-capability source: a /a //a ///a 4 5",
  });
  const authorityRequests: TypedKnowledgePackCitationAuthorityRequest[] = [];
  const harness = await startHarness(baseURL, bytes, authorityRequests, false);
  const publicationBefore = JSON.stringify(harness.publicationStore.readCurrent());
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));

  try {
    await enterRealApp(page, harness.proxy.origin);
    await expect(page.getByRole("button", { name: "Knowledge & defaults" })).toBeVisible();
    await uploadPrivateReference(page, bytes);
    const workbench = await openPageAtlas(page);
    await workbench.getByLabel("Extraction profile").selectOption("mace-musicks-monument-1676");
    await workbench.getByLabel("Exact local purpose").fill(EXACT_PURPOSE);
    await workbench.getByLabel("Attest to local extraction only").check();
    page.once("dialog", (dialog) => dialog.accept());
    await workbench.getByRole("button", { name: "Start local extraction" }).click();

    const release = workbench.locator(".typed-knowledge-release-workbench");
    await expect(release).toBeVisible();
    const previewResponse = page.waitForResponse((response) =>
      isTypedReleaseResponse(response.url(), response.request().method())
    );
    await release.getByRole("button", { name: "Preview typed knowledge release" }).click();
    const preview = await previewResponse;
    expect(preview.status()).toBe(200);
    expect(await preview.json()).toMatchObject({
      ok: true,
      data: {
        publicationState: "candidate",
        publicationOutcome: "preview_candidate",
        publicationCapability: {
          state: "unavailable",
          missingPrerequisites: ["pack_citation_authority", "system_identity"],
        },
      },
    });
    await expect(release).toContainText(
      "missing pack-citation authority provider and system identity"
    );
    await expect(release).toContainText("No human or historical authority is granted");
    await expect(release.getByRole("button", { name: /Publish/ })).toHaveCount(0);
    await expect(
      release.getByRole("button", { name: "Preview typed knowledge release" })
    ).toBeFocused();
    expect(JSON.stringify(harness.publicationStore.readCurrent())).toBe(publicationBefore);
    expect(authorityRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    if (!page.isClosed()) await page.goto("about:blank");
    await harness.close();
  }
});

type Harness = Readonly<{
  proxy: RealBrowserAppProxy;
  publicationStore: KnowledgePublicationStore;
  initialPublicationHead: Readonly<{ id: string; digest: string; revision: number }>;
  close: () => Promise<void>;
}>;

async function startHarness(
  frontendOrigin: string | undefined,
  bytes: Uint8Array,
  authorityRequests: TypedKnowledgePackCitationAuthorityRequest[],
  configurePublicationProviders = true
): Promise<Harness> {
  if (!frontendOrigin) throw new Error("The Playwright frontend origin is unavailable");
  const root = mkdtempSync(path.join(tmpdir(), "vellum-t12-real-browser-"));
  for (const directory of ["owner", "migration", "workbench"]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  const stagingService = new ReferenceSourceStagingService({
    store: new ReferenceSourceStagingStore({ rootDirectory: path.join(root, "staging") }),
  });
  const controlledStore = new ReferenceSourceControlledArtifactStore({
    rootDirectory: path.join(root, "controlled"),
  });
  const publicationStore = new KnowledgePublicationStore({
    rootDirectory: path.join(root, "publication"),
  });
  const initialPublicationHead = advanceUnrelatedPublication(publicationStore, "initial");
  const profile = defineMacePageAtlasSourceProfile({
    id: "source-profile.synthetic-t12-mace.v1",
    registryRef: externalRef("registry.synthetic-t12-mace.v1"),
    evidenceRef: externalRef("fixture.synthetic-t12-mace.pdf"),
    exactAsset: {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.byteLength,
      mediaType: "application/pdf",
      pageCount: 3,
    },
    identity: {
      preferredTitle: "Synthetic T12 Mace-profile fixture",
      workDate: "2026",
      language: "en",
      claimantKind: "system",
    },
    atlas: {
      targetScanPage: 2,
      targetPrintedPage: "75",
      initialScanPages: [1, 2, 3],
      printedPageOffset: -73,
    },
    extraction: {
      originalTranscription: "a /a //a ///a 4 5",
      normalizedTranscription: "a /a //a ///a 4 5",
      mappings: [
        { course: 7, symbol: "a" },
        { course: 8, symbol: "/a" },
        { course: 9, symbol: "//a" },
        { course: 10, symbol: "///a" },
        { course: 11, symbol: "4" },
        { course: 12, symbol: "5" },
      ],
      regions: {
        text: { x: 0.1, y: 0.65, width: 0.65, height: 0.08 },
        notation: { x: 0.45, y: 0.5, width: 0.35, height: 0.12 },
      },
    },
  });
  let proxy: RealBrowserAppProxy | undefined;
  try {
    proxy = await startRealBrowserAppProxy({
      frontendOrigin,
      createApiApp: (browserOrigin) =>
        createApp({
          security: { host: "127.0.0.1", frontendOrigin: browserOrigin, mode: "local" },
          referenceSourceStagingService: stagingService,
          referenceSourceControlledArtifactStore: controlledStore,
          knowledgePublicationStore: publicationStore,
          ownerReferenceMigrationOwnerRootDirectory: path.join(root, "owner"),
          ownerReferenceMigrationPrivateRootDirectory: path.join(root, "migration"),
          ownerReferenceWorkbenchPrivateRootDirectory: path.join(root, "workbench"),
          ownerReferenceWorkbenchOpaqueKey: new Uint8Array(32).fill(0x12),
          referencePageAtlasParser: new PopplerReferencePageAtlasParser(),
          referencePageAtlasSourceProfileResolver:
            new ExactAssetReferencePageAtlasSourceProfileResolver([profile]),
          ...(configurePublicationProviders
            ? {
                typedKnowledgePackCitationAuthorityProvider:
                  testPackCitationAuthorityProvider(authorityRequests),
                typedKnowledgeSystemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
              }
            : {}),
        }),
    });
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
  return {
    proxy,
    publicationStore,
    initialPublicationHead,
    close: async () => {
      await proxy.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function advanceUnrelatedPublication(
  store: KnowledgePublicationStore,
  suffix: string
): Readonly<{ id: string; digest: string; revision: number }> {
  const current = store.readCurrent();
  const result = store.publish({
    schemaVersion: 1,
    transactionId: `transaction.t12-browser-${suffix}`,
    writerKind: "system",
    expectedHead: current
      ? {
          id: current.generation.id,
          digest: current.generation.digest,
          revision: current.generation.revision,
        }
      : null,
    writes: [
      {
        recordKind: "knowledge_library_inventory_snapshot",
        id: `inventory.t12-browser-${suffix}`,
        successorRefs: [],
        content: { fixture: `unrelated-${suffix}` },
      },
    ],
  });
  return {
    id: result.generation.id,
    digest: result.generation.digest,
    revision: result.generation.revision,
  };
}

function testPackCitationAuthorityProvider(
  requests: TypedKnowledgePackCitationAuthorityRequest[]
): TypedKnowledgePackCitationAuthorityProvider {
  return {
    resolvePackCitationAuthority: (request) => {
      requests.push(structuredClone(request));
      const assertions = request.requiredSubjectFacets.map(
        ({ subjectRef, facet }, index) =>
          withReferenceRecordDigest({
            recordKind: "rights_assertion",
            id: `rights.synthetic-t12.${String(index).padStart(2, "0")}`,
            version: 1,
            subjectRef,
            subjectKind: subjectKindForRequirement(subjectRef, facet),
            rightsKind: facet,
            status: "permitted",
            claimant: { kind: "system", claimantRef: externalRef("claimant.synthetic-t12") },
            evidenceRefs: [externalRef(`evidence.synthetic-t12.${index}`)],
            assertedAt: request.effectiveAt,
          }) as ReferenceRightsAssertion
      );
      const decision = withReferenceRecordDigest({
        recordKind: "access_decision",
        id: "access.synthetic-t12.pack-citation",
        version: 1,
        outcome: "allow",
        operation: request.operation,
        sourceRefs: [...request.sourceRefs],
        derivativeRefs: [...request.derivativeRefs],
        destination: request.destination,
        purpose: request.purpose,
        policyRef: request.accessPolicyRef,
        rightsAssertionRefs: assertions.map(recordRef),
        authorityRefs: [externalRef("authority.synthetic-t12")],
        rationale: "Deterministic browser fixture authority closure",
        decidedAt: request.effectiveAt,
      }) as ReferenceAccessDecision;
      const unsignedReceipt = {
        recordKind: "reference_authority_verification_receipt",
        schemaVersion: 1,
        id: "authority-receipt.synthetic-t12.pack-citation",
        observedSnapshotRef: request.observedSnapshotRef,
        accessDecisionRef: recordRef(decision),
        accessDecisionFirstObservedRevision: 1,
        reviewedProvenanceSubstitutionRefs: [],
        currentRightsAssertionRefs: assertions.map(recordRef),
        rightsAssertionObservations: assertions.map((assertion) => ({
          rightsAssertionRef: recordRef(assertion),
          firstObservedRevision: 1,
        })),
        authoritySubjectRefs: [...request.authoritySubjectRefs],
        verifiedAuthorityRefs: [...decision.authorityRefs],
        requiredFacets: [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation],
        requiredSubjectFacets: [...request.requiredSubjectFacets],
        verifierRef: request.verifierRef,
        verifierPolicyRef: request.verifierPolicyRef,
        verifiedAt: request.effectiveAt,
        proof: {
          kind: "server_signature",
          algorithm: "hmac-sha256",
          keyId: "synthetic-t12-test-key",
          signature: "pending",
        },
      } as const;
      const placeholder = {
        ...unsignedReceipt,
        digest: "0".repeat(64),
      } as ReferenceAuthorityVerificationReceipt;
      const signature = createHmac("sha256", AUTHORITY_TEST_SECRET)
        .update(referenceAuthorityReceiptSigningPayload(placeholder))
        .digest("base64url");
      const receipt = withReferenceRecordDigest({
        ...unsignedReceipt,
        proof: { ...unsignedReceipt.proof, signature },
      }) as ReferenceAuthorityVerificationReceipt;
      return {
        accessDecisions: [decision],
        rightsAssertions: assertions,
        receipt,
      };
    },
    verifyPersistedReceipt: ({ signingPayload, receipt: candidate }) =>
      candidate.proof.signature ===
      createHmac("sha256", AUTHORITY_TEST_SECRET).update(signingPayload).digest("base64url"),
  };
}

function subjectKindForRequirement(
  subjectRef: ReferenceRecordRef,
  facet: TypedKnowledgePackCitationAuthorityRequest["requiredSubjectFacets"][number]["facet"]
): ReferenceRightsAssertion["subjectKind"] {
  switch (facet) {
    case "underlying_work_status":
      return "work";
    case "manifestation_editorial":
      return "source_manifestation";
    case "exemplar_restriction":
      return "exemplar";
    case "scan_provider_terms":
      return "digital_asset";
    case "attribution":
      return "asset_acquisition";
    case "pack_citation_excerpt":
      if (subjectRef.id.startsWith("source-segment")) return "source_segment_version";
      if (subjectRef.id.startsWith("cited-extraction")) return "cited_extraction_version";
      if (subjectRef.id.startsWith("extraction-proposal")) return "extraction_proposal";
      throw new Error("Pack-citation derivative is outside the exact T12 closure");
    default:
      throw new Error(`Unexpected T12 authority facet: ${facet}`);
  }
}

async function enterRealApp(page: Page, origin: string): Promise<void> {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    try {
      window.localStorage.setItem("vellum.guided-start.seen", "true");
    } catch {
      // Storage can be unavailable under browser privacy policy; the dialog
      // fallback below remains authoritative for the top-level app.
    }
  });
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const guidedStart = page.locator("#guided-start");
  if (await guidedStart.isVisible()) {
    await guidedStart.getByRole("button", { name: "Close", exact: true }).click();
  }
}

async function uploadPrivateReference(page: Page, bytes: Uint8Array): Promise<void> {
  await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  const workbench = page.locator("#vellum-owner-workbench");
  await expect(workbench).toBeVisible();
  const library = workbench.locator(".owner-reference-library-workbench");
  await library.getByLabel("Private PDF or image").setInputFiles({
    name: PRIVATE_FILENAME,
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await library.getByRole("button", { name: "Add to Owner Reference Library" }).click();
  await expect(library.locator(".owner-reference-library-card")).toHaveCount(1);
}

async function openPageAtlas(page: Page): Promise<Locator> {
  const ownerWorkbench = page.locator("#vellum-owner-workbench");
  if (!(await ownerWorkbench.isVisible())) {
    await page.getByRole("button", { name: "Knowledge & defaults" }).click();
  }
  const library = ownerWorkbench.locator(".owner-reference-library-workbench");
  await expect(library).toBeVisible();
  const card = library.locator(".owner-reference-library-card").first();
  await expect(card).toBeVisible();
  const access = card.locator(".owner-reference-library-access");
  if (!(await access.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await access.getByText("Review private access defaults", { exact: true }).click();
  }
  await card.getByLabel("Local operation").selectOption("local_extraction");
  await card.getByLabel("Purpose for this review").fill(EXACT_PURPOSE);
  await card.getByRole("button", { name: "Review local processing" }).click();
  const pageAtlas = page.locator(".owner-reference-page-atlas-workbench");
  await expect(pageAtlas).toBeVisible();
  return pageAtlas;
}

function isTypedReleaseResponse(url: string, method: string): boolean {
  if (
    new URL(url).pathname !== "/api/owner/reference-source-workbench/typed-knowledge-release" ||
    method !== "POST"
  ) {
    return false;
  }
  return true;
}

function recordRef(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}
