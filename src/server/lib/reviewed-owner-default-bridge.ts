import type { PersonalDefaultCandidate } from "../../lib/owner-domain.js";
import { assertAuthorityPathRuntime } from "../../lib/authority-path-runtime.js";
import { OwnerStore } from "./owner-store.js";

export type ReviewedOwnerDefaultAcceptance = {
  proposalId: string;
  proposalKind: "personal_default";
  reviewBoundary: string;
  reviewerRole: string;
  dimension: string;
  value: unknown;
  scope: Record<string, string>;
  evidenceChoiceIds: string[];
};

/**
 * The only bridge from evaluator-side learning proposals into production
 * Owner defaults. The bridge independently requires the exact Owner review
 * boundary and creates only a candidate; activation remains a separate Owner
 * approval in OwnerStore.approveDefaultCandidate.
 */
export function acceptReviewedOwnerDefault(
  store: OwnerStore,
  input: ReviewedOwnerDefaultAcceptance
): PersonalDefaultCandidate {
  assertAuthorityPathRuntime("authority.cache.owner-personal-defaults", "production");
  if (
    input.proposalKind !== "personal_default" ||
    input.reviewBoundary !== "owner_personal_default" ||
    input.reviewerRole !== "owner"
  ) {
    throw new Error("Personal Default learning requires the explicit Owner review boundary");
  }
  if (!input.proposalId.trim() || !input.dimension.trim()) {
    throw new Error("Reviewed Personal Default acceptance lacks a proposal or dimension");
  }
  if (
    input.evidenceChoiceIds.length === 0 ||
    new Set(input.evidenceChoiceIds).size !== input.evidenceChoiceIds.length
  ) {
    throw new Error("Reviewed Personal Default acceptance requires unique supporting evidence");
  }
  return store.proposeDefaultCandidate({
    dimension: input.dimension,
    value: input.value,
    scope: input.scope,
    evidenceChoiceIds: input.evidenceChoiceIds,
  });
}
