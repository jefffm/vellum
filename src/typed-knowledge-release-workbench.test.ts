// @vitest-environment jsdom

import { Value } from "@sinclair/typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ReferencePageAtlasOpaqueHmacRef,
  ReferencePageAtlasProjection,
} from "./lib/reference-page-atlas-contract.js";
import type {
  TypedKnowledgeReleaseOperationRequest,
  TypedKnowledgeReleaseProjection,
} from "./lib/typed-knowledge-release-contract.js";
import { TypedKnowledgeReleaseProjectionSchema } from "./lib/typed-knowledge-release-contract.js";
import { createTypedKnowledgeReleaseWorkbench } from "./typed-knowledge-release-workbench.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("typed knowledge release Workbench", () => {
  it("appears only for an exact staged Mace candidate and never duplicates on rerender", () => {
    const container = document.createElement("div");
    const operate = vi.fn(async () => candidateProjection());
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });

    workbench.render(container, {
      ...macePageAtlasProjection(),
      profile: "generic_paged_source",
      stagedKnowledge: { kind: "none", reason: "generic_profile_has_no_seed" },
    });
    expect(container.querySelector(".typed-knowledge-release-workbench")).toBeNull();

    const pageAtlas = macePageAtlasProjection();
    workbench.render(container, pageAtlas);
    workbench.render(container, pageAtlas);
    expect(container.querySelectorAll(".typed-knowledge-release-workbench")).toHaveLength(1);
    expect(container.textContent).toContain("No human or historical authority is granted");
    expect(container.textContent).toContain("default activation remains denied");
    expect(operate).not.toHaveBeenCalled();

    workbench.render(container, {
      ...pageAtlas,
      profile: "generic_paged_source",
      stagedKnowledge: { kind: "none", reason: "generic_profile_has_no_seed" },
    });
    expect(container.querySelector(".typed-knowledge-release-workbench")).toBeNull();

    workbench.render(container, pageAtlas);
    expect(container.querySelector(".typed-knowledge-release-workbench")).not.toBeNull();
    workbench.close();
    expect(container.querySelector(".typed-knowledge-release-workbench")).toBeNull();
  });

  it("passes exactly five opaque refs, preserves visible status, and publishes against the preview head", async () => {
    const pageAtlas = macePageAtlasProjection();
    const preview = candidateProjection();
    const published = publishedProjection("publish_committed");
    expect([...Value.Errors(TypedKnowledgeReleaseProjectionSchema, preview)]).toEqual([]);
    expect([...Value.Errors(TypedKnowledgeReleaseProjectionSchema, published)]).toEqual([]);
    const operate = vi
      .fn<(request: TypedKnowledgeReleaseOperationRequest) => Promise<unknown>>()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(published);
    const container = document.createElement("div");
    document.body.append(container);
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
    workbench.render(container, pageAtlas);

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(operate).toHaveBeenCalledOnce());
    expect(operate.mock.calls[0]![0]).toEqual({
      schemaVersion: 1,
      action: "preview",
      selection: {
        workbenchSnapshotRef: pageAtlas.workbenchSnapshotRef,
        workbenchCardRef: pageAtlas.workbenchCardRef,
        operationRef: pageAtlas.operationRef,
        expectedProjectionRef: pageAtlas.projectionRef,
        candidateRef:
          pageAtlas.stagedKnowledge.kind === "mace_twelve_course_diapason_notation"
            ? pageAtlas.stagedKnowledge.candidateRef
            : undefined,
      },
    });
    await vi.waitFor(() => expect(container.textContent).toContain("Candidate"));
    expect(document.activeElement).toBe(button(container, "Preview typed knowledge release"));
    expect(container.textContent).toContain("Preview ready");
    expect(container.textContent).toContain("Draft");
    expect(container.textContent).toContain("Immutable release");
    expect(container.textContent).toContain("Open question");
    expect(container.textContent).toContain(preview.draft.contentMerkleRoot);
    expect(container.textContent).toContain("Not evaluated");
    expect(container.textContent).toContain("Not issued");
    expect(container.querySelectorAll(".typed-knowledge-release-workbench")).toHaveLength(1);

    button(container, "Publish immutable test-only knowledge release").click();
    await vi.waitFor(() => expect(operate).toHaveBeenCalledTimes(2));
    expect(operate.mock.calls[1]![0]).toEqual({
      schemaVersion: 1,
      action: "publish",
      selection: expect.any(Object),
      expectedPublicationHead: preview.publicationHead,
    });
    await vi.waitFor(() => expect(container.textContent).toContain("Issued test-only"));
    expect(container.textContent).toContain("Immutable test-only release published");
    expect(container.textContent).toContain("Denied · no activation decision exists");
    expect(
      container.querySelector('[aria-label="Publish immutable test-only knowledge release"]')
    ).toBeNull();
    expect(document.activeElement).toBe(button(container, "Preview typed knowledge release"));
  });

  it("rejects a mismatched or open response without rendering backend details", async () => {
    const pageAtlas = macePageAtlasProjection();
    const leaked = {
      ...candidateProjection(),
      selection: {
        ...selectionFixture(),
        workbenchSnapshotRef: opaqueRef("different-snapshot", "e"),
      },
      privateSourcePath: "/Owner/private/Mace.pdf",
    };
    const operate = vi.fn(async () => leaked);
    const container = document.createElement("div");
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
    workbench.render(container, pageAtlas);

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(container.textContent).toContain("preview is unavailable"));
    expect(container.textContent).not.toContain("/Owner/private/Mace.pdf");
    expect(container.textContent).not.toContain("Immutable release ·");
  });

  it("treats a dropped publish response as uncertain and resolves it by preview replay", async () => {
    const operate = vi
      .fn<(request: TypedKnowledgeReleaseOperationRequest) => Promise<unknown>>()
      .mockResolvedValueOnce(candidateProjection())
      .mockRejectedValueOnce(new Error("PRIVATE-SERVER-DIAGNOSTIC"))
      .mockResolvedValueOnce(publishedProjection("preview_existing"));
    const container = document.createElement("div");
    document.body.append(container);
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
    workbench.render(container, macePageAtlasProjection());

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(container.textContent).toContain("Preview ready"));
    button(container, "Publish immutable test-only knowledge release").click();
    await vi.waitFor(() =>
      expect(container.textContent).toContain("Publication was not confirmed")
    );
    expect(container.textContent).not.toContain("PRIVATE-SERVER-DIAGNOSTIC");
    expect(
      container.querySelector('[aria-label="Publish immutable test-only knowledge release"]')
    ).toBeNull();
    expect(document.activeElement).toBe(button(container, "Preview typed knowledge release"));

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() =>
      expect(container.textContent).toContain("existing immutable test-only release was found")
    );
    expect(container.textContent).toContain("Existing immutable publication found by preview");
    expect(container.querySelector(".typed-knowledge-release-status")?.textContent).not.toContain(
      "release published"
    );
  });

  it("withholds Publish until a successful preview after a failed publication", async () => {
    const operate = vi
      .fn<(request: TypedKnowledgeReleaseOperationRequest) => Promise<unknown>>()
      .mockResolvedValueOnce(candidateProjection())
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce(candidateProjection());
    const container = document.createElement("div");
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
    workbench.render(container, macePageAtlasProjection());

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(container.textContent).toContain("Preview ready"));
    button(container, "Publish immutable test-only knowledge release").click();
    await vi.waitFor(() =>
      expect(container.textContent).toContain("Publication was not confirmed")
    );
    expect(
      container.querySelector('[aria-label="Publish immutable test-only knowledge release"]')
    ).toBeNull();

    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(operate).toHaveBeenCalledTimes(3));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[aria-label="Publish immutable test-only knowledge release"]')
      ).not.toBeNull()
    );
  });

  it.each([
    {
      missingPrerequisites: ["pack_citation_authority"] as ["pack_citation_authority"],
      copy: "missing pack-citation authority provider",
    },
    {
      missingPrerequisites: ["system_identity"] as ["system_identity"],
      copy: "missing system identity",
    },
    {
      missingPrerequisites: ["pack_citation_authority", "system_identity"] as [
        "pack_citation_authority",
        "system_identity",
      ],
      copy: "missing pack-citation authority provider and system identity",
    },
  ])(
    "explains unavailable publication prerequisites and never offers Publish: $copy",
    async ({ missingPrerequisites, copy }) => {
      const operate = vi.fn(async () =>
        candidateProjection({
          state: "unavailable",
          missingPrerequisites,
        })
      );
      const container = document.createElement("div");
      const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
      workbench.render(container, macePageAtlasProjection());

      button(container, "Preview typed knowledge release").click();
      await vi.waitFor(() => expect(container.textContent).toContain(copy));
      expect(
        container.querySelector('[aria-label="Publish immutable test-only knowledge release"]')
      ).toBeNull();
    }
  );

  it("aborts an in-flight preview when its exact selection changes or the Workbench closes", async () => {
    const signals: AbortSignal[] = [];
    const operate = vi.fn(
      (_request: TypedKnowledgeReleaseOperationRequest, signal?: AbortSignal) =>
        new Promise<unknown>(() => {
          if (signal) signals.push(signal);
        })
    );
    const container = document.createElement("div");
    const workbench = createTypedKnowledgeReleaseWorkbench(document, { operate });
    const first = macePageAtlasProjection();
    workbench.render(container, first);
    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(signals).toHaveLength(1));

    workbench.render(container, {
      ...first,
      projectionRef: opaqueRef("projection.v2", "1"),
    });
    expect(signals[0]?.aborted).toBe(true);
    button(container, "Preview typed knowledge release").click();
    await vi.waitFor(() => expect(signals).toHaveLength(2));

    workbench.close();
    expect(signals[1]?.aborted).toBe(true);
    expect(container.querySelector(".typed-knowledge-release-workbench")).toBeNull();
  });
});

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

function projectionBase() {
  const draftRef = knowledgeRef("pack.mace.draft.v1", "1");
  const merkle = "2".repeat(64);
  return {
    schemaVersion: 1,
    selection: selectionFixture(),
    candidate: {
      mappingCandidateRef: knowledgeRef("candidate.mace.mapping.v1", "4"),
      course13QuestionCandidateRef: knowledgeRef("candidate.mace.course13.v1", "5"),
      authorityLane: "historical_practice",
      activationAllowed: false,
    },
    draft: { draftRef, contentMerkleRoot: merkle, closureMerkleRoot: "9".repeat(64) },
    release: {
      releaseRef: knowledgeRef("pack.mace.release.v1", "6"),
      sequence: 1,
      sourceDraftRef: draftRef,
      contentMerkleRoot: merkle,
      merkleRoot: "9".repeat(64),
      predecessorReleaseRef: null,
      successorState: "initial",
    },
    ordinaryActivation: { state: "not_evaluated", defaultActivation: "deny" },
  } as const;
}

function candidateProjection(
  publicationCapability:
    | { state: "configured"; authorityCheck: "required_on_publish" }
    | {
        state: "unavailable";
        missingPrerequisites:
          | ["pack_citation_authority"]
          | ["system_identity"]
          | ["pack_citation_authority", "system_identity"];
      } = { state: "configured", authorityCheck: "required_on_publish" }
): TypedKnowledgeReleaseProjection {
  return {
    ...projectionBase(),
    publicationState: "candidate",
    publicationOutcome: "preview_candidate",
    publicationHead: null,
    publicationCapability,
    packCitationAuthority: "not_evaluated",
    testAttestation: { state: "not_issued" },
  };
}

function publishedProjection(
  publicationOutcome: "preview_existing" | "publish_committed" | "publish_idempotent"
): TypedKnowledgeReleaseProjection {
  return {
    ...projectionBase(),
    publicationState: "published",
    publicationOutcome,
    publicationHead: {
      id: "publication-generation.mace.v1",
      digest: "3".repeat(64),
      revision: 1,
    },
    publicationCapability: { state: "configured", authorityCheck: "required_on_publish" },
    packCitationAuthority: "verified_for_publication",
    testAttestation: {
      state: "issued_test_only",
      attestationRef: knowledgeRef("attestation.mace.test-only.v1", "7"),
      testPolicyRef: knowledgeRef("policy.test-only.v1", "8"),
      humanAuthority: false,
      historicalAuthority: false,
      activationAuthority: false,
    },
  };
}

function selectionFixture() {
  const pageAtlas = macePageAtlasProjection();
  if (pageAtlas.stagedKnowledge.kind !== "mace_twelve_course_diapason_notation") {
    throw new Error("Expected Mace fixture");
  }
  return {
    workbenchSnapshotRef: pageAtlas.workbenchSnapshotRef,
    workbenchCardRef: pageAtlas.workbenchCardRef,
    operationRef: pageAtlas.operationRef,
    expectedProjectionRef: pageAtlas.projectionRef,
    candidateRef: pageAtlas.stagedKnowledge.candidateRef,
  };
}

function macePageAtlasProjection(): ReferencePageAtlasProjection {
  const atlasRef = opaqueRef("atlas.v1", "a");
  const segmentRef = opaqueRef("segment.v1", "b");
  return {
    schemaVersion: 1,
    projectionRef: opaqueRef("projection.v1", "d"),
    workbenchSnapshotRef: opaqueRef("snapshot.v1", "a"),
    workbenchCardRef: opaqueRef("card.v1", "b"),
    operationRef: opaqueRef("operation.v1", "f"),
    profile: "mace-musicks-monument-1676",
    profileSelection: "owner_selected",
    publicationState: "staging_only",
    authorityState: "non_authoritative",
    boundary: {
      processing: "local_only",
      authorization: "owner_attested_local_extraction",
      network: "disabled",
      providerEgress: "deny",
      fixtureInclusion: "deny",
      repositoryInclusion: "deny",
      export: "deny",
      redistribution: "deny",
    },
    atlas: {
      atlasRef,
      version: 1,
      parentAtlasRef: null,
      state: "complete",
      coverage: {
        enumeratedPages: 1,
        rasterObservedPages: 1,
        contentCandidatePages: 1,
        mappingReviewedPages: 1,
        totalPages: 1,
        remainingPages: 0,
        percentComplete: 100,
        completeness: "complete",
      },
      checkpointRef: null,
      stop: null,
    },
    target: {
      targetRef: opaqueRef("target.v1", "0"),
      scanPageNumber: 1,
      printedLocator: { state: "known", value: "75" },
      mappingState: "reviewed",
      canvas: {
        coordinateSystem: "normalized-top-left.v1",
        widthPixels: 100,
        heightPixels: 100,
        rotationDegrees: 0,
      },
      pageState: {
        enumeration: "enumerated",
        rasterization: "immutable_derivative_available",
        contentExtraction: "candidate_extracted",
        mappingReview: "owner_reviewed",
      },
    },
    citedSegmentLineage: {
      currentSegmentRef: segmentRef,
      versions: [
        {
          segmentRef,
          version: 1,
          parentSegmentRef: null,
          successorSegmentRef: null,
          pageAtlasRef: atlasRef,
          scanPageNumber: 1,
          printedLocator: { state: "known", value: "75" },
          mappingState: "reviewed",
          citationState: "immutable",
          authorityState: "non_authoritative",
          previewState: "immutable_derivative_available",
          anchors: [
            {
              anchorRef: opaqueRef("anchor.v1", "9"),
              kind: "notation",
              region: { x: 0, y: 0, width: 1, height: 1 },
              reviewState: "reviewed",
              contentState: "withheld_local_only",
            },
          ],
        },
      ],
    },
    confidence: {
      sourceIdentity: { state: "assessed", value: 1, basis: "owner_review" },
      pageMapping: { state: "assessed", value: 1, basis: "owner_review" },
      extraction: { state: "assessed", value: 1, basis: "typed_extraction" },
      interpretation: { state: "unknown", reason: "not_assessed" },
      applicability: { state: "unknown", reason: "not_assessed" },
    },
    stagedKnowledge: {
      kind: "mace_twelve_course_diapason_notation",
      candidateRef: opaqueRef("candidate.mace", "c"),
      reviewState: "staged",
      authorityState: "non_authoritative",
      profileScope: "mace-musicks-monument-1676",
      courseMappings: [
        { course: 7, sign: "a" },
        { course: 8, sign: "/a" },
        { course: 9, sign: "//a" },
        { course: 10, sign: "///a" },
        { course: 11, sign: "4" },
        { course: 12, sign: "5" },
      ],
      course13Question: {
        questionRef: opaqueRef("question.course13", "e"),
        course: 13,
        status: "open",
        historicalSignState: "unresolved",
        proposedSign: null,
        authorityState: "non_authoritative",
        question:
          "Which directly applicable historical source establishes the thirteenth-course sign?",
      },
    },
  };
}

function opaqueRef(suffix: string, digest: string): ReferencePageAtlasOpaqueHmacRef {
  return { id: `owner-reference-${suffix}`, digest: digest.repeat(64) };
}

function knowledgeRef(id: string, digest: string) {
  return { id, digest: digest.repeat(64) };
}
