import { createHash, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityVerificationReceipt,
} from "../../src/lib/reference-source-authority.js";
import {
  buildKnowledgeSystemIdentitySnapshot,
  computeSystemTestOnlyAttestationDigest,
  validateKnowledgePackRelease,
  validateSystemTestOnlyAttestationStructure,
} from "../../src/lib/reviewed-knowledge-contract.js";
import {
  canonicalReferenceJson,
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceAssetAcquisition,
  type ReferenceDigitalAsset,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
  type ReferenceSourceStagingTransaction,
} from "../../src/lib/reference-source-domain.js";
import type {
  TypedKnowledgeReleaseProjection,
  TypedKnowledgeReleaseSelection,
} from "../../src/lib/typed-knowledge-release-contract.js";
import {
  KnowledgePublicationStore,
  knowledgePublicationRequestDigestForTransaction,
  knowledgePublicationRecordRefForWrite,
} from "../../src/server/lib/knowledge-publication-store.js";
import { OwnerReferencePageAtlasService } from "../../src/server/lib/owner-reference-page-atlas-service.js";
import type { ReferencePageAtlasParser } from "../../src/server/lib/reference-page-atlas-parser.js";
import {
  ExactAssetReferencePageAtlasSourceProfileResolver,
  defineMacePageAtlasSourceProfile,
} from "../../src/server/lib/reference-page-atlas-source-profile.js";
import {
  createOwnerLocalExtractionStagingWriter,
  createReferenceSourcePageAtlasStagingWriter,
  ReferenceSourceStagingService,
} from "../../src/server/lib/reference-source-staging-service.js";
import { ReferenceSourceStagingStore } from "../../src/server/lib/reference-source-staging-store.js";
import {
  TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF,
  TypedKnowledgeReleaseAuthorityError,
  TypedKnowledgeReleaseCancelledError,
  TypedKnowledgeReleaseConflictError,
  TypedKnowledgeReleaseService,
  TypedKnowledgeReleaseUnavailableError,
  type TypedKnowledgePackCitationAuthorityProvider,
  type TypedKnowledgePackCitationAuthorityRequest,
  type TypedKnowledgeSystemIdentityProvider,
} from "../../src/server/lib/typed-knowledge-release-service.js";
import { OwnerReferenceWorkbenchOpaqueProjector } from "../../src/server/lib/owner-reference-workbench-service.js";

const NOW = "2026-07-16T16:00:00.000Z";
const OPERATION_KEY = "owner-page-atlas.v1.AAAAAAAAAAAAAAAAAAAAAA";
const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.7\nrights-approved synthetic T12 production-boundary fixture"
);
const RECEIPT_KEY = new Uint8Array(32).fill(29);
const TEST_SYSTEM_IDENTITY = buildKnowledgeSystemIdentitySnapshot({
  recordKind: "knowledge_system_identity_snapshot",
  schemaVersion: 1,
  id: "system-identity.vellum.typed-release.vitest-t12",
  systemKind: "vellum_server",
  buildRef: externalRef("build.vellum.vitest.t12.fixture"),
  environmentRef: externalRef("environment.vellum.vitest.node"),
});
const TEST_SYSTEM_IDENTITY_PROVIDER: TypedKnowledgeSystemIdentityProvider = {
  resolveSystemIdentity: () => TEST_SYSTEM_IDENTITY,
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("T12 typed knowledge evidence and immutable release production boundary", () => {
  it("reconstructs the exact T11 seed, publishes one atomic T07 release, and response-drop replays", async () => {
    const harness = await createHarness();
    const preview = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });

    expect(preview).toMatchObject({
      publicationState: "candidate",
      publicationOutcome: "preview_candidate",
      publicationHead: null,
      publicationCapability: {
        state: "configured",
        authorityCheck: "required_on_publish",
      },
      selection: harness.selection,
      packCitationAuthority: "not_evaluated",
      testAttestation: { state: "not_issued" },
      ordinaryActivation: { state: "not_evaluated", defaultActivation: "deny" },
    });
    expect(preview.release.sequence).toBe(1);
    expect(preview.release.predecessorReleaseRef).toBeNull();
    expect(preview.candidate.activationAllowed).toBe(false);

    const request = {
      schemaVersion: 1 as const,
      action: "publish" as const,
      selection: harness.selection,
      expectedPublicationHead: preview.publicationHead,
    };
    const published = harness.release.publish({ request, context: harness.context });
    const committed = harness.publication.readCurrent()!;

    expect(published).toMatchObject({
      publicationState: "published",
      publicationOutcome: "publish_committed",
      selection: harness.selection,
      packCitationAuthority: "verified_for_publication",
      testAttestation: {
        state: "issued_test_only",
        humanAuthority: false,
        historicalAuthority: false,
        activationAuthority: false,
      },
      ordinaryActivation: { state: "not_evaluated", defaultActivation: "deny" },
    });
    expect(committed.records.map(({ recordKind }) => recordKind)).toEqual(
      expect.arrayContaining([
        "knowledge_applicability_predicate",
        "knowledge_candidate",
        "knowledge_evidence_edge",
        "knowledge_constraint_derivation",
        "knowledge_component_binding",
        "knowledge_component_mapping",
        "knowledge_profile",
        "knowledge_pack_draft",
        "knowledge_pack_release",
        "authority_verification",
        "knowledge_system_identity_snapshot",
        "knowledge_test_policy",
        "release_attestation",
      ])
    );
    expect(
      committed.records.filter(({ recordKind }) => recordKind === "knowledge_pack_release")
    ).toHaveLength(1);
    expect(
      committed.records.filter(({ recordKind }) => recordKind === "release_attestation")
    ).toHaveLength(1);
    expect(
      committed.records.filter(
        ({ recordKind }) => recordKind === "knowledge_system_identity_snapshot"
      )
    ).toHaveLength(1);
    expect(
      committed.records.filter(({ recordKind }) => recordKind === "knowledge_test_policy")
    ).toHaveLength(1);

    const replayed = harness.release.publish({ request, context: harness.context });
    expect(replayed.publicationOutcome).toBe("publish_idempotent");
    expect(replayed.release).toEqual(published.release);
    expect(harness.publication.readCurrent()!.head).toEqual(committed.head);
    expect(harness.authorityRequests).toHaveLength(1);
    expect(harness.authorityRequests[0]).toMatchObject({
      operation: "pack_citation",
      destination: { kind: "repository", id: "vellum.reviewed-knowledge-library" },
      accessPolicyRef: TYPED_KNOWLEDGE_PACK_CITATION_POLICY_REF,
    });
    expect(harness.authorityRequests[0]!.sourceRefs).toHaveLength(5);
    expect(harness.authorityRequests[0]!.derivativeRefs).toHaveLength(4);
  });

  it("publishes a changed cited extraction only as an immutable successor", async () => {
    const harness = await createHarness();
    const first = publishPreview(harness.release, harness.selection, harness.context);
    const firstSnapshot = harness.publication.readCurrent()!;
    const firstReleaseRecord = firstSnapshot.records.find(
      ({ recordKind }) => recordKind === "knowledge_pack_release"
    )!;

    await harness.pageAtlas.correctMapping({
      request: {
        schemaVersion: 1,
        action: "correct_mapping",
        workbenchSnapshotRef: harness.projection.workbenchSnapshotRef,
        workbenchCardRef: harness.projection.workbenchCardRef,
        operationRef: harness.projection.operationRef,
        expectedProjectionRef: harness.projection.projectionRef,
        correction: {
          scanPageNumber: 105,
          printedLocator: "75r",
          reason: "Bind the successor synthetic printed locator.",
        },
      },
      context: harness.context,
    });
    const successorContext = harness.resolveContext(3);
    const successorProjection = harness.pageAtlas.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: successorContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: successorContext.currentWorkbenchCardRef,
        operationRef: harness.projection.operationRef,
      },
      context: successorContext,
    });
    const successorSelection = selectionFrom(successorProjection);
    const successorPreview = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: successorSelection },
      context: successorContext,
    });
    expect(successorPreview.release).toMatchObject({
      sequence: 2,
      predecessorReleaseRef: first.release.releaseRef,
      successorState: "successor",
    });
    expect(successorPreview.release.releaseRef).not.toEqual(first.release.releaseRef);

    const successor = harness.release.publish({
      request: {
        schemaVersion: 1,
        action: "publish",
        selection: successorSelection,
        expectedPublicationHead: successorPreview.publicationHead,
      },
      context: successorContext,
    });
    const successorSnapshot = harness.publication.readCurrent()!;
    expect(successor.release.sequence).toBe(2);
    expect(
      successorSnapshot.records.filter(({ recordKind }) => recordKind === "knowledge_pack_release")
    ).toHaveLength(2);
    const preserved = successorSnapshot.records.find(({ id }) => id === firstReleaseRecord.id)!;
    expect(preserved).toEqual(firstReleaseRecord);

    await harness.pageAtlas.correctMapping({
      request: {
        schemaVersion: 1,
        action: "correct_mapping",
        workbenchSnapshotRef: successorProjection.workbenchSnapshotRef,
        workbenchCardRef: successorProjection.workbenchCardRef,
        operationRef: successorProjection.operationRef,
        expectedProjectionRef: successorProjection.projectionRef,
        correction: {
          scanPageNumber: 105,
          printedLocator: "75v",
          reason: "Bind a second correction and preserve the complete candidate lineage.",
        },
      },
      context: successorContext,
    });
    const thirdContext = harness.resolveContext(4);
    const thirdProjection = harness.pageAtlas.read({
      request: {
        schemaVersion: 1,
        action: "read",
        workbenchSnapshotRef: thirdContext.currentWorkbenchSnapshotRef,
        workbenchCardRef: thirdContext.currentWorkbenchCardRef,
        operationRef: successorProjection.operationRef,
      },
      context: thirdContext,
    });
    const thirdSelection = selectionFrom(thirdProjection);
    const third = publishPreview(harness.release, thirdSelection, thirdContext);
    expect(third.release).toMatchObject({
      sequence: 3,
      predecessorReleaseRef: successor.release.releaseRef,
      successorState: "successor",
    });
    const thirdRecord = harness.publication
      .readCurrent()!
      .records.find(
        ({ recordKind, content }) =>
          recordKind === "knowledge_pack_release" &&
          typeof content === "object" &&
          content !== null &&
          "sequence" in content &&
          content.sequence === 3
      )!;
    const thirdRelease = validateKnowledgePackRelease(thirdRecord.content);
    expect(thirdRelease.candidates).toHaveLength(6);
    expect(thirdRelease.evidenceEdges.filter(({ role }) => role === "supersession")).toHaveLength(
      4
    );
  });

  it("requires the pinned persisted-receipt verifier across process restarts", async () => {
    const harness = await createHarness();
    const published = publishPreview(harness.release, harness.selection, harness.context);
    const committed = structuredClone(harness.publication.readCurrent()!);

    const withoutVerifier = new TypedKnowledgeReleaseService({
      pageAtlasService: harness.pageAtlas,
      publicationStore: harness.publication,
      systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
      now: () => new Date(NOW),
    });
    expect(() =>
      withoutVerifier.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseUnavailableError);
    expect(harness.publication.readCurrent()).toEqual(committed);

    const wrongPinnedVerifier: TypedKnowledgePackCitationAuthorityProvider = {
      ...harness.authorityProvider!,
      verifyPersistedReceipt: ({ receipt }) => receipt.proof.keyId === "test-key.t12" && false,
    };
    const wrongKey = new TypedKnowledgeReleaseService({
      pageAtlasService: harness.pageAtlas,
      publicationStore: harness.publication,
      packCitationAuthorityProvider: wrongPinnedVerifier,
      systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
      now: () => new Date(NOW),
    });
    expect(() =>
      wrongKey.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseUnavailableError);
    expect(harness.publication.readCurrent()).toEqual(committed);

    const restarted = new TypedKnowledgeReleaseService({
      pageAtlasService: harness.pageAtlas,
      publicationStore: harness.publication,
      packCitationAuthorityProvider: harness.authorityProvider,
      now: () => new Date(NOW),
    });
    const replay = restarted.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });
    expect(replay).toMatchObject({
      publicationState: "published",
      publicationOutcome: "preview_existing",
      packCitationAuthority: "verified_for_publication",
      publicationCapability: {
        state: "unavailable",
        missingPrerequisites: ["system_identity"],
      },
      release: published.release,
    });
    expect(harness.publication.readCurrent()).toEqual(committed);
  });

  it.each(["receipt", "decision_commitment", "assertion_refs"] as const)(
    "rejects tampered persisted authority provenance on replay: %s",
    async (fault) => {
      const harness = await createHarness();
      publishPreview(harness.release, harness.selection, harness.context);
      const committed = harness.publication.readCurrent()!;
      const injected = structuredClone(committed);
      const authorityRecord = injected.records.find(
        ({ recordKind }) => recordKind === "authority_verification"
      )!;
      const content = authorityRecord.content as Record<string, any>;
      if (fault === "receipt") {
        content.receipt.proof.signature = "valid_shape_but_wrong_signature";
        const { digest: _receiptDigest, ...receiptCore } = content.receipt;
        content.receipt = { ...receiptCore, digest: referenceSourceDigest(receiptCore) };
      } else if (fault === "decision_commitment") {
        content.decisionCommitment.accessDecisionRef = externalRef("access-decision.other");
      } else {
        content.decisionCommitment.rightsAssertionRefs = [externalRef("rights.other")];
      }
      const { digest: _authorityDigest, ...authorityCore } = content;
      authorityRecord.content = {
        ...authorityCore,
        digest: referenceSourceDigest(authorityCore),
      };
      const injectedBoundary = {
        readCurrent: () => structuredClone(injected),
        readGeneration: (generationId: string) => harness.publication.readGeneration(generationId),
        publish: harness.publication.publish.bind(harness.publication),
      };
      const restarted = new TypedKnowledgeReleaseService({
        pageAtlasService: harness.pageAtlas,
        publicationStore: injectedBoundary,
        packCitationAuthorityProvider: harness.authorityProvider,
        systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
        now: () => new Date(NOW),
      });
      expect(() =>
        restarted.preview({
          request: { schemaVersion: 1, action: "preview", selection: harness.selection },
          context: harness.context,
        })
      ).toThrow(TypedKnowledgeReleaseUnavailableError);
      expect(harness.publication.readCurrent()).toEqual(committed);
    }
  );

  it("rejects an existing derivative match resolved against the wrong exact source closure", async () => {
    const harness = await createHarness();
    publishPreview(harness.release, harness.selection, harness.context);
    const committed = structuredClone(harness.publication.readCurrent()!);
    const mismatchedPageAtlas = {
      resolveKnowledgeReleaseSeed: (
        input: Parameters<OwnerReferencePageAtlasService["resolveKnowledgeReleaseSeed"]>[0]
      ) => {
        const seed = harness.pageAtlas.resolveKnowledgeReleaseSeed(input);
        const { digest: _digest, ...acquisitionCore } = seed.acquisition;
        const acquisition = withReferenceRecordDigest({
          ...acquisitionCore,
          id: "acquisition.t12-wrong-source-closure",
        }) as ReferenceAssetAcquisition;
        return { ...seed, acquisition };
      },
    };
    const restarted = new TypedKnowledgeReleaseService({
      pageAtlasService: mismatchedPageAtlas,
      publicationStore: harness.publication,
      packCitationAuthorityProvider: harness.authorityProvider,
      systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
      now: () => new Date(NOW),
    });
    expect(() =>
      restarted.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseUnavailableError);
    expect(harness.publication.readCurrent()).toEqual(committed);
  });

  it("fails closed with zero publication side effects for absent authority, stale CAS, and cancellation", async () => {
    const absent = await createHarness({ authority: null });
    const absentPreview = absent.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: absent.selection },
      context: absent.context,
    });
    await expect(() =>
      absent.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: absent.selection,
          expectedPublicationHead: absentPreview.publicationHead,
        },
        context: absent.context,
      })
    ).toThrow(TypedKnowledgeReleaseAuthorityError);
    expect(absent.publication.readCurrent()).toBeNull();

    const stale = await createHarness();
    const bogusHead = {
      id: "publication-generation.not-current",
      digest: "0".repeat(64),
      revision: 1,
    };
    expect(() =>
      stale.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: stale.selection,
          expectedPublicationHead: bogusHead,
        },
        context: stale.context,
      })
    ).toThrow(TypedKnowledgeReleaseConflictError);
    expect(stale.publication.readCurrent()).toBeNull();

    const controller = new AbortController();
    const cancelled = await createHarness({ abortAfterAuthority: controller });
    const cancelledPreview = cancelled.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: cancelled.selection },
      context: cancelled.context,
    });
    expect(() =>
      cancelled.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: cancelled.selection,
          expectedPublicationHead: cancelledPreview.publicationHead,
        },
        context: cancelled.context,
        signal: controller.signal,
      })
    ).toThrow(TypedKnowledgeReleaseCancelledError);
    expect(cancelled.publication.readCurrent()).toBeNull();
    expect(cancelled.authoritySignals).toEqual([controller.signal]);
  });

  it("rejects a real concurrent non-null head advance before authority or typed writes", async () => {
    const harness = await createHarness();
    const preview = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });
    harness.publication.publish({
      schemaVersion: 1,
      transactionId: "transaction.t12.concurrent-head-advance",
      writerKind: "advisory",
      expectedHead: null,
      writes: [
        {
          recordKind: "release_advisory",
          id: "release-advisory.t12.concurrent",
          successorRefs: [],
          content: { kind: "unrelated_concurrent_advance" },
        },
      ],
    });
    expect(() =>
      harness.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: harness.selection,
          expectedPublicationHead: preview.publicationHead,
        },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseConflictError);
    expect(harness.authorityRequests).toEqual([]);
    expect(
      harness.publication
        .readCurrent()!
        .records.filter(({ recordKind }) => recordKind === "knowledge_pack_release")
    ).toHaveLength(0);
  });

  it("treats a post-commit abort or dropped response as an idempotent retry", async () => {
    const harness = await createHarness();
    const controller = new AbortController();
    const boundary = {
      readCurrent: harness.publication.readCurrent.bind(harness.publication),
      readGeneration: harness.publication.readGeneration.bind(harness.publication),
      publish: (transaction: Parameters<KnowledgePublicationStore["publish"]>[0]) => {
        const result = harness.publication.publish(transaction);
        controller.abort();
        return result;
      },
    };
    const release = new TypedKnowledgeReleaseService({
      pageAtlasService: harness.pageAtlas,
      publicationStore: boundary,
      packCitationAuthorityProvider: harness.authorityProvider,
      systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
      now: () => new Date(NOW),
    });
    const preview = release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });
    const request = {
      schemaVersion: 1 as const,
      action: "publish" as const,
      selection: harness.selection,
      expectedPublicationHead: preview.publicationHead,
    };
    const committed = release.publish({
      request,
      context: harness.context,
      signal: controller.signal,
    });
    expect(controller.signal.aborted).toBe(true);
    expect(committed.publicationOutcome).toBe("publish_committed");
    const head = structuredClone(harness.publication.readCurrent()!.head);

    const retry = release.publish({ request, context: harness.context });
    expect(retry.publicationOutcome).toBe("publish_idempotent");
    expect(harness.publication.readCurrent()!.head).toEqual(head);
    expect(
      harness.publication
        .readCurrent()!
        .records.filter(({ recordKind }) => recordKind === "knowledge_pack_release")
    ).toHaveLength(1);
  });

  it("uses locale-independent code-point ordering for exact transaction digests", () => {
    const writes = [
      {
        recordKind: "knowledge_profile" as const,
        id: "published.profile_a",
        successorRefs: [],
        content: { marker: "underscore" },
      },
      {
        recordKind: "knowledge_profile" as const,
        id: "published.profile-a",
        successorRefs: [],
        content: { marker: "hyphen" },
      },
    ];
    const normalized = {
      schemaVersion: 1 as const,
      transactionId: "transaction.t12.code-point-order",
      writerKind: "system" as const,
      expectedHead: null,
      writes: [writes[1]!, writes[0]!],
    };
    const expected = createHash("sha256")
      .update("vellum.knowledge-publication.v1\u0000")
      .update("transaction")
      .update("\u0000")
      .update(canonicalReferenceJson(normalized))
      .digest("hex");
    expect(knowledgePublicationRequestDigestForTransaction({ ...normalized, writes })).toBe(
      expected
    );
    expect(
      knowledgePublicationRequestDigestForTransaction({
        ...normalized,
        writes: [...writes].reverse(),
      })
    ).toBe(expected);
  });

  it.each([
    {
      label: "neither provider",
      authority: null,
      systemIdentity: false,
      capability: {
        state: "unavailable",
        missingPrerequisites: ["pack_citation_authority", "system_identity"],
      },
      error: TypedKnowledgeReleaseAuthorityError,
    },
    {
      label: "system identity only",
      authority: null,
      systemIdentity: true,
      capability: {
        state: "unavailable",
        missingPrerequisites: ["pack_citation_authority"],
      },
      error: TypedKnowledgeReleaseAuthorityError,
    },
    {
      label: "pack authority only",
      authority: "valid" as const,
      systemIdentity: false,
      capability: { state: "unavailable", missingPrerequisites: ["system_identity"] },
      error: TypedKnowledgeReleaseUnavailableError,
    },
    {
      label: "both providers",
      authority: "valid" as const,
      systemIdentity: true,
      capability: { state: "configured", authorityCheck: "required_on_publish" },
      error: null,
    },
  ])("projects and preflights the exact capability matrix: $label", async (fixture) => {
    const harness = await createHarness({
      authority: fixture.authority,
      ...(fixture.systemIdentity ? {} : { systemIdentity: false }),
    });
    const preview = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });
    expect(preview.publicationCapability).toEqual(fixture.capability);
    const publish = () =>
      harness.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: harness.selection,
          expectedPublicationHead: preview.publicationHead,
        },
        context: harness.context,
      });
    if (fixture.error) {
      expect(publish).toThrow(fixture.error);
      expect(harness.publication.readCurrent()).toBeNull();
      expect(harness.authorityRequests).toEqual([]);
    } else {
      expect(publish().publicationOutcome).toBe("publish_committed");
      expect(harness.authorityRequests).toHaveLength(1);
    }
  });

  it.each(["bad_signature", "subject_facet_mismatch", "deny", "throw"] as const)(
    "rejects %s authority closure before any publication write",
    async (authority) => {
      const harness = await createHarness({ authority });
      const preview = harness.release.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      });

      expect(() =>
        harness.release.publish({
          request: {
            schemaVersion: 1,
            action: "publish",
            selection: harness.selection,
            expectedPublicationHead: preview.publicationHead,
          },
          context: harness.context,
        })
      ).toThrow(TypedKnowledgeReleaseAuthorityError);
      expect(harness.publication.readCurrent()).toBeNull();
    }
  );

  it("accepts symmetric bounded skew between the authority, attestation, and store clocks", async () => {
    const attestationIssuedAt = "2026-07-16T16:00:30.000Z";
    const harness = await createHarness({
      releaseNow: attestationIssuedAt,
      publicationNow: NOW,
    });

    publishPreview(harness.release, harness.selection, harness.context);

    const record = harness.publication
      .readCurrent()!
      .records.find(({ recordKind }) => recordKind === "release_attestation")!;
    const attestation = validateSystemTestOnlyAttestationStructure(record.content);
    expect(attestation.issuedAt).toBe(attestationIssuedAt);
    expect(attestation.issuedAt).not.toBe(NOW);
    expect(harness.authorityRequests[0]!.effectiveAt).toBe(attestationIssuedAt);
    const authority = harness.publication
      .readCurrent()!
      .records.find(({ recordKind }) => recordKind === "authority_verification")!.content as {
      evaluatedAt: string;
    };
    expect(authority.evaluatedAt).toBe(attestationIssuedAt);
    expect(harness.publication.readCurrent()!.generation.createdAt).toBe(NOW);
  });

  it.each(["knowledge_pack_release", "authority_verification"] as const)(
    "rejects a %s record pre-injected before the coupled mint generation",
    async (preinjectedKind) => {
      const harness = await createHarness();
      let intercepted = false;
      const boundary = {
        readCurrent: harness.publication.readCurrent.bind(harness.publication),
        readGeneration: harness.publication.readGeneration.bind(harness.publication),
        publish: (transaction: Parameters<KnowledgePublicationStore["publish"]>[0]) => {
          if (intercepted) return harness.publication.publish(transaction);
          intercepted = true;
          const write = transaction.writes.find(({ recordKind }) => recordKind === preinjectedKind);
          if (!write) throw new Error(`Missing ${preinjectedKind} write`);
          const injected = harness.publication.publish({
            schemaVersion: 1,
            transactionId: `transaction.t12.preinject-${preinjectedKind}`,
            writerKind: "system",
            expectedHead: transaction.expectedHead,
            writes: [write],
          });
          return harness.publication.publish({
            ...transaction,
            expectedHead: {
              id: injected.generation.id,
              digest: injected.generation.digest,
              revision: injected.generation.revision,
            },
          });
        },
      };
      const release = new TypedKnowledgeReleaseService({
        pageAtlasService: harness.pageAtlas,
        publicationStore: boundary,
        packCitationAuthorityProvider: harness.authorityProvider,
        systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
        now: () => new Date(NOW),
      });
      const preview = release.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      });
      expect(() =>
        release.publish({
          request: {
            schemaVersion: 1,
            action: "publish",
            selection: harness.selection,
            expectedPublicationHead: preview.publicationHead,
          },
          context: harness.context,
        })
      ).toThrow(TypedKnowledgeReleaseUnavailableError);
      const latest = harness.publication.readCurrent()!;
      expect(
        latest.generation.newRecordRefs.some(({ recordKind }) => recordKind === preinjectedKind)
      ).toBe(false);
    }
  );

  it("fails closed before publication when no exact server system identity is configured", async () => {
    const harness = await createHarness({ systemIdentity: false });
    const preview = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });

    expect(() =>
      harness.release.publish({
        request: {
          schemaVersion: 1,
          action: "publish",
          selection: harness.selection,
          expectedPublicationHead: preview.publicationHead,
        },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseUnavailableError);
    expect(harness.publication.readCurrent()).toBeNull();
  });

  it.each(["corrupt", "duplicate"] as const)(
    "fails the strict post-publication reread when the exact release record is %s",
    async (fault) => {
      const harness = await createHarness();
      let published = false;
      const publicationBoundary = {
        readCurrent: () => {
          const snapshot = harness.publication.readCurrent();
          if (!published || !snapshot) return snapshot;
          const altered = structuredClone(snapshot);
          const release = altered.records.find(
            ({ recordKind }) => recordKind === "knowledge_pack_release"
          )!;
          if (fault === "duplicate") {
            altered.records.push(structuredClone(release));
          } else {
            release.content = { forged: "post-publication-reread" };
          }
          return altered;
        },
        readGeneration: (generationId: string) => harness.publication.readGeneration(generationId),
        publish: (transaction: Parameters<KnowledgePublicationStore["publish"]>[0]) => {
          const result = harness.publication.publish(transaction);
          published = true;
          return result;
        },
      };
      const service = new TypedKnowledgeReleaseService({
        pageAtlasService: harness.pageAtlas,
        publicationStore: publicationBoundary,
        packCitationAuthorityProvider: harness.authorityProvider,
        systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
        now: () => new Date(NOW),
      });
      const preview = service.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      });

      expect(() =>
        service.publish({
          request: {
            schemaVersion: 1,
            action: "publish",
            selection: harness.selection,
            expectedPublicationHead: preview.publicationHead,
          },
          context: harness.context,
        })
      ).toThrow(TypedKnowledgeReleaseUnavailableError);
      expect(
        harness.publication
          .readCurrent()!
          .records.filter(({ recordKind }) => recordKind === "knowledge_pack_release")
      ).toHaveLength(1);
    }
  );

  it("rejects a separately injected valid-digest attestation outside its immutable mint generation", async () => {
    const harness = await createHarness();
    publishPreview(harness.release, harness.selection, harness.context);
    const canonical = harness.publication.readCurrent()!;
    const injected = structuredClone(canonical);
    const originalRecord = injected.records.find(
      ({ recordKind }) => recordKind === "release_attestation"
    )!;
    const original = validateSystemTestOnlyAttestationStructure(originalRecord.content);
    const { digest: _originalDigest, ...originalCore } = original;
    const forgedCore = {
      ...originalCore,
      issuedAt: "2026-07-16T15:59:00.000Z",
    };
    const forged = validateSystemTestOnlyAttestationStructure({
      ...forgedCore,
      digest: computeSystemTestOnlyAttestationDigest(forgedCore),
    });
    const forgedWrite = {
      recordKind: "release_attestation" as const,
      id: `published.release_attestation.${forged.digest}`,
      successorRefs: [],
      content: forged,
    };
    const forgedRecordRef = knowledgePublicationRecordRefForWrite(forgedWrite);
    Object.assign(originalRecord, {
      ...forgedRecordRef,
      schemaVersion: 1 as const,
      successorRefs: [],
      content: forged,
    });
    const injectedBoundary = {
      readCurrent: () => structuredClone(injected),
      readGeneration: (generationId: string) => harness.publication.readGeneration(generationId),
      publish: harness.publication.publish.bind(harness.publication),
    };
    const service = new TypedKnowledgeReleaseService({
      pageAtlasService: harness.pageAtlas,
      publicationStore: injectedBoundary,
      packCitationAuthorityProvider: harness.authorityProvider,
      systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER,
      now: () => new Date(NOW),
    });

    expect(() =>
      service.preview({
        request: { schemaVersion: 1, action: "preview", selection: harness.selection },
        context: harness.context,
      })
    ).toThrow(TypedKnowledgeReleaseUnavailableError);
  });

  it("coexists with unrelated future pack and attestation payloads", async () => {
    const harness = await createHarness();
    harness.publication.publish({
      schemaVersion: 1,
      transactionId: "future-unrelated-publication",
      writerKind: "system",
      expectedHead: null,
      writes: [
        {
          recordKind: "knowledge_pack_release",
          id: "published.future-pack.release",
          successorRefs: [],
          content: {
            recordKind: "knowledge_pack_release_v99",
            packId: "knowledge-pack.future-unrelated",
            opaqueFutureShape: true,
          },
        },
        {
          recordKind: "release_attestation",
          id: "published.future-pack.attestation",
          successorRefs: [],
          content: {
            recordKind: "release_attestation_v99",
            kind: "future_authoritative_form",
            opaqueFutureShape: true,
          },
        },
      ],
    });

    const published = publishPreview(harness.release, harness.selection, harness.context);

    expect(published.publicationState).toBe("published");
    expect(harness.publication.readCurrent()!.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "published.future-pack.release" }),
        expect.objectContaining({ id: "published.future-pack.attestation" }),
      ])
    );

    const typedGeneration = harness.publication.readCurrent()!.generation;
    harness.publication.publish({
      schemaVersion: 1,
      transactionId: "future-publication-after-typed-release",
      writerKind: "advisory",
      expectedHead: {
        id: typedGeneration.id,
        digest: typedGeneration.digest,
        revision: typedGeneration.revision,
      },
      writes: [
        {
          recordKind: "release_advisory",
          id: "published.future-advisory.after-typed-release",
          successorRefs: [],
          content: { schemaVersion: 99, kind: "future_advisory" },
        },
      ],
    });
    const reread = harness.release.preview({
      request: { schemaVersion: 1, action: "preview", selection: harness.selection },
      context: harness.context,
    });
    expect(reread.publicationState).toBe("published");
    expect(reread.release.releaseRef).toEqual(published.release.releaseRef);
  });
});

async function createHarness(
  options: {
    authority?: "valid" | "bad_signature" | "subject_facet_mismatch" | "deny" | "throw" | null;
    abortAfterAuthority?: AbortController;
    releaseNow?: string;
    publicationNow?: string;
    systemIdentity?: false;
  } = {}
) {
  const stagingRoot = temporaryRoot("vellum-t12-staging-");
  const publicationRoot = temporaryRoot("vellum-t12-publication-");
  const stagingStore = new ReferenceSourceStagingStore({ rootDirectory: stagingRoot });
  let transactionSequence = 0;
  const staging = new ReferenceSourceStagingService({
    store: stagingStore,
    now: () => new Date(NOW),
    createId: () => `t12-staging-${++transactionSequence}`,
  });
  const asset = record({
    recordKind: "digital_asset" as const,
    id: "asset.t12-mace",
    sha256: createHash("sha256").update(PDF_BYTES).digest("hex"),
    mediaType: "application/pdf",
    byteLength: PDF_BYTES.byteLength,
  }) as ReferenceDigitalAsset;
  const acquisition = record({
    recordKind: "asset_acquisition" as const,
    id: "acquisition.t12-mace",
    digitalAssetRef: ref(asset),
    representedExemplarRefs: [],
    origin: { sourceKind: "upload" as const, ownerActionRef: externalRef("owner-action.t12") },
    acquiredAt: NOW,
    rightsAssertionRefs: [],
    processingPolicyRef: externalRef("processing-policy.t12"),
  }) as ReferenceAssetAcquisition;
  const seed: ReferenceSourceStagingTransaction = {
    schemaVersion: 1,
    id: "transaction.t12.seed",
    operations: [asset, acquisition].map((sourceRecord) => ({
      type: "append_record" as const,
      record: sourceRecord,
    })),
    submittedAt: NOW,
  };
  staging.applyTransaction(seed);

  const projector = new OwnerReferenceWorkbenchOpaqueProjector(new Uint8Array(32).fill(17));
  const cardRef = projector.project("t12-card", "mace");
  const resolveContext = (version: number) => {
    const state = stagingStore.readCurrentState()!;
    return {
      currentWorkbenchSnapshotRef: projector.project("t12-workbench-snapshot", version),
      currentWorkbenchCardRef: cardRef,
      currentStagingSnapshotRef: ref(state.snapshot),
      acquisition,
      digitalAsset: asset,
    };
  };
  const writer = createReferenceSourcePageAtlasStagingWriter(staging);
  const pageAtlas = new OwnerReferencePageAtlasService({
    localExtractionWriter: createOwnerLocalExtractionStagingWriter(staging),
    pageAtlasWriter: writer,
    stagingStore,
    controlledArtifacts: { readDigitalAssetBytes: () => new Uint8Array(PDF_BYTES) },
    parser: parserFixture(),
    sourceProfileResolver: new ExactAssetReferencePageAtlasSourceProfileResolver([
      sourceProfile(asset),
    ]),
    opaqueProjector: projector,
    now: () => new Date(NOW),
    resumeBatchPages: 2,
  });
  const initialContext = resolveContext(1);
  const started = await pageAtlas.start({
    request: {
      schemaVersion: 1,
      action: "start",
      workbenchSnapshotRef: initialContext.currentWorkbenchSnapshotRef,
      workbenchCardRef: initialContext.currentWorkbenchCardRef,
      purpose: "Build the exact synthetic T12 Mace Page Atlas.",
      authorization: "owner_attested_local_extraction",
      operationKey: OPERATION_KEY,
      profile: "mace-musicks-monument-1676",
      profileSelection: "owner_selected",
    },
    context: initialContext,
  });
  const context = resolveContext(2);
  const projection = pageAtlas.read({
    request: {
      schemaVersion: 1,
      action: "read",
      workbenchSnapshotRef: context.currentWorkbenchSnapshotRef,
      workbenchCardRef: context.currentWorkbenchCardRef,
      operationRef: started.operationRef,
    },
    context,
  });
  const selection = selectionFrom(projection);
  const publication = new KnowledgePublicationStore({
    rootDirectory: publicationRoot,
    now: () => new Date(options.publicationNow ?? options.releaseNow ?? NOW),
  });
  const authorityRequests: TypedKnowledgePackCitationAuthorityRequest[] = [];
  const authoritySignals: Array<AbortSignal | undefined> = [];
  const authorityProvider =
    options.authority === null
      ? undefined
      : authorityFixture(
          authorityRequests,
          options.abortAfterAuthority,
          options.authority ?? "valid",
          authoritySignals
        );
  const release = new TypedKnowledgeReleaseService({
    pageAtlasService: pageAtlas,
    publicationStore: publication,
    ...(authorityProvider ? { packCitationAuthorityProvider: authorityProvider } : {}),
    ...(options.systemIdentity === false
      ? {}
      : { systemIdentityProvider: TEST_SYSTEM_IDENTITY_PROVIDER }),
    now: () => new Date(options.releaseNow ?? NOW),
  });
  return {
    pageAtlas,
    publication,
    release,
    context,
    projection,
    selection,
    resolveContext,
    authorityRequests,
    authoritySignals,
    authorityProvider,
  };
}

function publishPreview(
  service: TypedKnowledgeReleaseService,
  selection: TypedKnowledgeReleaseSelection,
  context: Parameters<TypedKnowledgeReleaseService["preview"]>[0]["context"]
): TypedKnowledgeReleaseProjection {
  const preview = service.preview({
    request: { schemaVersion: 1, action: "preview", selection },
    context,
  });
  return service.publish({
    request: {
      schemaVersion: 1,
      action: "publish",
      selection,
      expectedPublicationHead: preview.publicationHead,
    },
    context,
  });
}

function selectionFrom(
  projection: ReturnType<OwnerReferencePageAtlasService["read"]>
): TypedKnowledgeReleaseSelection {
  if (projection.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
    throw new Error("Expected a staged Mace candidate");
  }
  return {
    workbenchSnapshotRef: projection.workbenchSnapshotRef,
    workbenchCardRef: projection.workbenchCardRef,
    operationRef: projection.operationRef,
    expectedProjectionRef: projection.projectionRef,
    candidateRef: projection.stagedKnowledge.candidateRef,
  };
}

function authorityFixture(
  requests: TypedKnowledgePackCitationAuthorityRequest[],
  abortAfterAuthority: AbortController | undefined,
  behavior: "valid" | "bad_signature" | "subject_facet_mismatch" | "deny" | "throw",
  signals: Array<AbortSignal | undefined>
): TypedKnowledgePackCitationAuthorityProvider {
  return {
    resolvePackCitationAuthority(request, signal) {
      signals.push(signal);
      if (behavior === "throw") throw new Error("synthetic provider failure");
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      requests.push(structuredClone(request));
      const evidenceRef = externalRef("evidence.t12-pack-citation-review");
      const claimantRef = externalRef("authority.t12-rights-reviewer");
      const assertions = request.requiredSubjectFacets.map(
        ({ subjectRef, facet }, index) =>
          withReferenceRecordDigest({
            recordKind: "rights_assertion" as const,
            id: `rights.t12.${index + 1}.${facet}`,
            version: 1,
            subjectRef,
            subjectKind: subjectKind(subjectRef),
            rightsKind: facet,
            status:
              facet === "underlying_work_status"
                ? ("public_domain" as const)
                : ("permitted" as const),
            claimant: { kind: "system" as const, claimantRef },
            evidenceRefs: [evidenceRef],
            assertedAt: NOW,
          }) as ReferenceRightsAssertion
      );
      const authorityRef = externalRef("authority.t12-pack-citation");
      const decision = withReferenceRecordDigest({
        recordKind: "access_decision" as const,
        id: "access-decision.t12-pack-citation",
        version: 1,
        outcome: behavior === "deny" ? ("deny" as const) : ("allow" as const),
        operation: "pack_citation" as const,
        sourceRefs: [...request.sourceRefs],
        derivativeRefs: [...request.derivativeRefs],
        destination: request.destination,
        purpose: request.purpose,
        policyRef: request.accessPolicyRef,
        rightsAssertionRefs: assertions.map(ref),
        authorityRefs: [authorityRef],
        rationale: "Exact synthetic fixture authority for the T12 production-boundary test.",
        decidedAt: NOW,
      }) as ReferenceAccessDecision;
      const receipt = signedReceipt({
        recordKind: "reference_authority_verification_receipt",
        schemaVersion: 1,
        id: "authority-receipt.t12-pack-citation",
        observedSnapshotRef: request.observedSnapshotRef,
        accessDecisionRef: ref(decision),
        accessDecisionFirstObservedRevision: 1,
        reviewedProvenanceSubstitutionRefs: [],
        currentRightsAssertionRefs: assertions.map(ref),
        rightsAssertionObservations: assertions.map((assertion) => ({
          rightsAssertionRef: ref(assertion),
          firstObservedRevision: 1,
        })),
        authoritySubjectRefs: [...request.authoritySubjectRefs],
        verifiedAuthorityRefs: [authorityRef],
        requiredFacets: [...REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS.pack_citation],
        requiredSubjectFacets:
          behavior === "subject_facet_mismatch"
            ? [...request.requiredSubjectFacets.slice(0, -1)]
            : [...request.requiredSubjectFacets],
        verifierRef: request.verifierRef,
        verifierPolicyRef: request.verifierPolicyRef,
        verifiedAt: request.effectiveAt,
        proof: {
          kind: "server_signature",
          algorithm: "hmac-sha256",
          keyId: "test-key.t12",
          signature: "placeholder",
        },
      });
      return {
        accessDecisions: [decision],
        rightsAssertions: assertions,
        receipt,
      };
    },
    verifyPersistedReceipt: ({ receipt: candidate, signingPayload }) => {
      abortAfterAuthority?.abort();
      return behavior !== "bad_signature" && candidate.proof.signature === sign(signingPayload);
    },
  };
}

function signedReceipt(
  core: Omit<ReferenceAuthorityVerificationReceipt, "digest">
): ReferenceAuthorityVerificationReceipt {
  const placeholder = withReferenceRecordDigest(core) as ReferenceAuthorityVerificationReceipt;
  const signature = sign(referenceAuthorityReceiptSigningPayload(placeholder));
  return withReferenceRecordDigest({
    ...core,
    proof: { ...core.proof, signature },
  }) as ReferenceAuthorityVerificationReceipt;
}

function sign(payload: string): string {
  return createHmac("sha256", RECEIPT_KEY).update(payload).digest("base64url");
}

function subjectKind(subjectRef: ReferenceRecordRef) {
  if (subjectRef.id.startsWith("work.")) return "work" as const;
  if (subjectRef.id.startsWith("manifestation.")) return "source_manifestation" as const;
  if (subjectRef.id.startsWith("exemplar.")) return "exemplar" as const;
  if (subjectRef.id.startsWith("asset.")) return "digital_asset" as const;
  if (subjectRef.id.startsWith("acquisition.")) return "asset_acquisition" as const;
  if (subjectRef.id.startsWith("source-segment.")) return "source_segment_version" as const;
  if (subjectRef.id.startsWith("cited-extraction.")) return "cited_extraction_version" as const;
  if (subjectRef.id.startsWith("extraction-proposal.")) return "extraction_proposal" as const;
  throw new Error(`Unknown synthetic authority subject ${subjectRef.id}`);
}

function parserFixture(): ReferencePageAtlasParser {
  return {
    describeRuntime: vi.fn(async () => runtimeIdentity()),
    inspect: vi.fn(async () => ({
      schemaVersion: 1,
      parserId: "poppler.pdfinfo" as const,
      pageCount: 110,
      pages: Array.from({ length: 110 }, (_, index) => ({
        scanOrdinal: index + 1,
        widthPoints: 409,
        heightPoints: 674,
        rotationDegrees: 0 as const,
      })),
    })),
    renderPage: vi.fn(async ({ scanOrdinal }) => ({
      schemaVersion: 1,
      rendererId: "poppler.pdftoppm" as const,
      scanOrdinal,
      mediaType: "image/png" as const,
      widthPixels: 818,
      heightPixels: 1_348,
      bytes: new Uint8Array([137, 80, 78, 71, scanOrdinal & 0xff]),
    })),
  };
}

function runtimeIdentity() {
  return {
    schemaVersion: 1 as const,
    runtimeId: "reference-page-atlas.poppler.local.v1",
    parser: {
      id: "poppler.pdfinfo" as const,
      executable: "pdfinfo" as const,
      artifact: "poppler" as const,
      version: "26.04.0-synthetic",
    },
    renderer: {
      id: "poppler.pdftoppm" as const,
      executable: "pdftoppm" as const,
      artifact: "poppler" as const,
      version: "26.04.0-synthetic",
    },
    schemas: {
      inspection: "vellum.reference-page-atlas-inspection.v1" as const,
      renderedPage: "vellum.reference-page-atlas-rendered-page.v1" as const,
      atlas: "vellum.reference-page-atlas-version.v1" as const,
      sourceSegment: "vellum.reference-source-segment-version.v1" as const,
      browserProjection: "vellum.reference-page-atlas-projection.v1" as const,
    },
    configuration: {
      limits: {
        maxInputBytes: 32 * 1024 * 1024,
        maxProcessAddressSpaceBytes: 768 * 1024 * 1024,
        maxOpenFiles: 64,
        maxPages: 2_048,
        maxPageWidthPoints: 2_880,
        maxPageHeightPoints: 2_880,
        maxPageAreaPointsSquared: 4_147_200,
        inspectTimeoutMs: 15_000,
        maxInspectOutputBytes: 2 * 1024 * 1024,
        renderTimeoutMs: 20_000,
        renderDpi: 144,
        maxRenderedWidthPixels: 4_096,
        maxRenderedHeightPixels: 4_096,
        maxRenderedPixels: 16_777_216,
        maxRenderedOutputBytes: 16 * 1024 * 1024,
        maxRenderDiagnosticBytes: 64 * 1024,
      },
    },
  };
}

function sourceProfile(asset: ReferenceDigitalAsset) {
  return defineMacePageAtlasSourceProfile({
    id: "source-profile.mace.synthetic-t12.v1",
    registryRef: externalRef("registry.reference-source-profile.synthetic-t12.v1"),
    evidenceRef: externalRef("fixture.synthetic-mace-t12.pdf"),
    exactAsset: {
      sha256: asset.sha256,
      byteLength: asset.byteLength,
      mediaType: "application/pdf",
      pageCount: 110,
    },
    identity: {
      preferredTitle: "Synthetic Mace T12 fixture",
      workDate: "1676",
      language: "en",
      claimantKind: "system",
    },
    atlas: {
      targetScanPage: 105,
      targetPrintedPage: "75",
      initialScanPages: [104, 105, 106],
      printedPageOffset: 30,
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
        text: { x: 0.103, y: 0.644, width: 0.655, height: 0.064 },
        notation: { x: 0.511, y: 0.554, width: 0.249, height: 0.085 },
      },
    },
  });
}

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function record<T extends Record<string, unknown>>(core: T) {
  return withReferenceRecordDigest(core);
}

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}
