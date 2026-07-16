import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  REFERENCE_OPERATION_REQUIRED_AUTHORITY_FACETS,
  referenceAuthorityReceiptSigningPayload,
  type ReferenceAuthorityVerificationReceipt,
} from "../../src/lib/reference-source-authority.js";
import {
  referenceSourceDigest,
  withReferenceRecordDigest,
  type ReferenceAccessDecision,
  type ReferenceRecordRef,
  type ReferenceRightsAssertion,
} from "../../src/lib/reference-source-domain.js";
import { buildKnowledgeSystemIdentitySnapshot } from "../../src/lib/reviewed-knowledge-contract.js";
import type { TypedKnowledgeReleaseSelection } from "../../src/lib/typed-knowledge-release-contract.js";
import type {
  OwnerReferencePageAtlasKnowledgeReleaseSeed,
  OwnerReferencePageAtlasResolvedContext,
} from "../../src/server/lib/owner-reference-page-atlas-service.js";
import { KnowledgePublicationStore } from "../../src/server/lib/knowledge-publication-store.js";
import {
  TypedKnowledgeReleaseService,
  type TypedKnowledgePackCitationAuthorityProvider,
  type TypedKnowledgePackCitationAuthorityRequest,
} from "../../src/server/lib/typed-knowledge-release-service.js";

const NOW = "2026-07-16T16:00:00.000Z";
const RECEIPT_KEY = new Uint8Array(32).fill(41);

export function createT14KnowledgeResolutionFixture(rootDirectory: string) {
  const seed = JSON.parse(
    readFileSync(
      new URL("../instrument-intelligence/fixtures/t14-mace-release-seed.v1.json", import.meta.url),
      "utf8"
    )
  ) as OwnerReferencePageAtlasKnowledgeReleaseSeed;
  const store = new KnowledgePublicationStore({
    rootDirectory: path.join(rootDirectory, "publication"),
    now: () => new Date(NOW),
  });
  const selection: TypedKnowledgeReleaseSelection = {
    workbenchSnapshotRef: externalRef("owner-reference-workbench-snapshot.synthetic.t14"),
    workbenchCardRef: externalRef("owner-reference-workbench-card.synthetic.t14"),
    operationRef: externalRef("owner-reference-operation.synthetic.t14"),
    expectedProjectionRef: externalRef("owner-reference-projection.synthetic.t14"),
    candidateRef: externalRef("owner-reference-candidate.synthetic.t14"),
  };
  const release = new TypedKnowledgeReleaseService({
    pageAtlasService: {
      resolveKnowledgeReleaseSeed: () => structuredClone(seed),
    },
    publicationStore: store,
    packCitationAuthorityProvider: authorityProvider(),
    systemIdentityProvider: {
      resolveSystemIdentity: () =>
        buildKnowledgeSystemIdentitySnapshot({
          recordKind: "knowledge_system_identity_snapshot",
          schemaVersion: 1,
          id: "system-identity.vellum.synthetic-t14",
          systemKind: "vellum_server",
          buildRef: externalRef("build.vellum.synthetic-t14"),
          environmentRef: externalRef("environment.vellum.synthetic-t14"),
        }),
    },
    now: () => new Date(NOW),
  });
  const context = {} as OwnerReferencePageAtlasResolvedContext;
  const preview = release.preview({
    request: { schemaVersion: 1, action: "preview", selection },
    context,
  });
  const projection = release.publish({
    request: {
      schemaVersion: 1,
      action: "publish",
      selection,
      expectedPublicationHead: preview.publicationHead,
    },
    context,
  });
  return Object.freeze({ store, releaseProjection: projection, seed });
}

function authorityProvider(): TypedKnowledgePackCitationAuthorityProvider {
  return {
    resolvePackCitationAuthority(request) {
      const evidenceRef = externalRef("evidence.synthetic.t14-pack-citation-review");
      const claimantRef = externalRef("authority.synthetic.t14-rights-reviewer");
      const assertions = request.requiredSubjectFacets.map(
        ({ subjectRef, facet }, index) =>
          withReferenceRecordDigest({
            recordKind: "rights_assertion" as const,
            id: `rights.synthetic.t14.${index + 1}.${facet}`,
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
      const authorityRef = externalRef("authority.synthetic.t14-pack-citation");
      const decision = withReferenceRecordDigest({
        recordKind: "access_decision" as const,
        id: "access-decision.synthetic.t14-pack-citation",
        version: 1,
        outcome: "allow" as const,
        operation: "pack_citation" as const,
        sourceRefs: [...request.sourceRefs],
        derivativeRefs: [...request.derivativeRefs],
        destination: request.destination,
        purpose: request.purpose,
        policyRef: request.accessPolicyRef,
        rightsAssertionRefs: assertions.map(ref),
        authorityRefs: [authorityRef],
        rationale: "Exact synthetic authority closure for the T14 production boundary.",
        decidedAt: NOW,
      }) as ReferenceAccessDecision;
      const receipt = signedReceipt(request, decision, assertions, authorityRef);
      return { accessDecisions: [decision], rightsAssertions: assertions, receipt };
    },
    verifyPersistedReceipt: ({ receipt, signingPayload }) =>
      receipt.proof.signature === sign(signingPayload),
  };
}

function signedReceipt(
  request: TypedKnowledgePackCitationAuthorityRequest,
  decision: ReferenceAccessDecision,
  assertions: readonly ReferenceRightsAssertion[],
  authorityRef: ReferenceRecordRef
): ReferenceAuthorityVerificationReceipt {
  const core = {
    recordKind: "reference_authority_verification_receipt" as const,
    schemaVersion: 1 as const,
    id: "authority-receipt.synthetic.t14-pack-citation",
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
    requiredSubjectFacets: [...request.requiredSubjectFacets],
    verifierRef: request.verifierRef,
    verifierPolicyRef: request.verifierPolicyRef,
    verifiedAt: request.effectiveAt,
    proof: {
      kind: "server_signature" as const,
      algorithm: "hmac-sha256" as const,
      keyId: "test-key.synthetic-t14",
      signature: "pending",
    },
  };
  const placeholder = withReferenceRecordDigest(core) as ReferenceAuthorityVerificationReceipt;
  return withReferenceRecordDigest({
    ...core,
    proof: {
      ...core.proof,
      signature: sign(referenceAuthorityReceiptSigningPayload(placeholder)),
    },
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

function ref(value: { id: string; digest: string }): ReferenceRecordRef {
  return { id: value.id, digest: value.digest };
}

function externalRef(id: string): ReferenceRecordRef {
  return { id, digest: referenceSourceDigest({ id }) };
}
