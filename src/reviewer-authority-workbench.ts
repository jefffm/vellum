import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
import {
  ReviewerAuthorityWorkbenchProjectionSchema,
  type ReviewerAuthorityWorkbenchProjection,
} from "./lib/reviewer-authority-wire.js";

export function renderReviewerAuthorityWorkbench(
  container: HTMLElement,
  value: unknown
): ReviewerAuthorityWorkbenchProjection {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const projection = Value.Decode(ReviewerAuthorityWorkbenchProjectionSchema, value);
  const document = container.ownerDocument;
  const root = document.createElement("div");
  root.className = "reviewer-authority-workbench";
  const heading = document.createElement("h3");
  heading.textContent = "Reviewer authority and advisories";
  const boundary = document.createElement("p");
  boundary.className = "reviewer-authority-boundary";
  boundary.textContent =
    "Credentials and review claims do not grant authority by themselves. Only an external verifier authorized by the pinned Trust Policy can establish a scope for later resolution; this surface never publishes an activation decision.";
  root.append(heading, boundary);

  if (projection.state === "unconfigured") {
    const empty = document.createElement("p");
    empty.className = "reviewer-authority-unconfigured";
    empty.textContent =
      "No reviewer Trust Policy is configured. Human, historical, specialist, and advisory authority remain unavailable.";
    root.append(empty);
    container.replaceChildren(root);
    return projection;
  }

  const policy = document.createElement("dl");
  policy.className = "reviewer-authority-policy";
  definition(document, policy, "Trust Policy", formatRef(projection.policy.policyRef));
  definition(document, policy, "Policy validity", validityLabel(projection));
  definition(document, policy, "Clock policy", formatRef(projection.policy.clockPolicyRef));
  definition(
    document,
    policy,
    "Freshness limits",
    `receipt ${projection.policy.maximumReceiptAgeMs} ms · revocation ${projection.policy.maximumRevocationAgeMs} ms · clock skew ${projection.policy.maximumClockSkewMs} ms`
  );
  definition(
    document,
    policy,
    "Authorized sources",
    `${projection.policy.verifierCount} verifier entr${projection.policy.verifierCount === 1 ? "y" : "ies"} · ${projection.policy.revocationSourceCount} revocation source${projection.policy.revocationSourceCount === 1 ? "" : "s"}`
  );
  definition(
    document,
    policy,
    "Activation",
    projection.activationDecisionState === "not_present"
      ? "Not present · owned by the later resolver slice"
      : "Outside this Workbench's authority · owned by the later resolver slice"
  );
  root.append(policy);

  if (projection.policy.synthetic) {
    const synthetic = document.createElement("p");
    synthetic.className = "reviewer-authority-synthetic-warning";
    synthetic.textContent =
      "Synthetic contract-test policy: it demonstrates verification mechanics but conveys no real expertise, human authority, or historical authority.";
    root.append(synthetic);
  }

  const conflicts = document.createElement("p");
  conflicts.className = "reviewer-authority-conflicts";
  conflicts.textContent =
    projection.roleConflicts.length === 0
      ? "No role conflicts are present in the current verification closure."
      : `${projection.roleConflicts.length} role conflict${projection.roleConflicts.length === 1 ? "" : "s"} require independent assignment.`;
  root.append(conflicts);

  const list = document.createElement("div");
  list.className = "reviewer-authority-verifications";
  if (projection.verifications.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No externally verified reviewer or advisory status has been published.";
    list.append(empty);
  }
  for (const verification of projection.verifications) {
    const card = document.createElement("article");
    card.className = `reviewer-authority-verification reviewer-authority-${verification.result}`;
    const title = document.createElement("h4");
    title.textContent = `${humanize(verification.verificationKind)} · ${humanize(verification.reviewerRole)}`;
    const status = document.createElement("p");
    status.className = "reviewer-authority-result";
    status.textContent = `${humanize(verification.result)} · ${humanize(verification.reason)}`;
    card.append(title, status);
    const details = document.createElement("dl");
    definition(document, details, "Verifier", formatRef(verification.verifierIdentityRef));
    definition(document, details, "Policy", formatRef(verification.verifierPolicyRef));
    definition(document, details, "Freshness", humanize(verification.freshness));
    definition(document, details, "Revocation", humanize(verification.revocation));
    definition(document, details, "Checked", verification.checkedAt);
    definition(document, details, "Valid until", verification.validUntil ?? "No fixed boundary");
    definition(
      document,
      details,
      "Evidence sources",
      verification.sourceRefs.length > 0
        ? verification.sourceRefs.map(formatRef).join(" · ")
        : "None"
    );
    definition(
      document,
      details,
      "Verified scope",
      verification.evaluatedScope ? scopeLabel(verification.evaluatedScope) : "None"
    );
    definition(
      document,
      details,
      "Authorization intersection",
      verification.authorizationScope ? scopeLabel(verification.authorizationScope) : "None"
    );
    definition(
      document,
      details,
      "Authority",
      verification.authorityConferred
        ? "Eligible for later resolution inside the exact verified scope"
        : "None conferred"
    );
    definition(
      document,
      details,
      "Unclaimed dimensions",
      verification.unclaimedDimensions.length > 0
        ? verification.unclaimedDimensions.map(humanize).join(", ")
        : "None"
    );
    definition(
      document,
      details,
      "Disagreements",
      verification.disagreements.length > 0 ? verification.disagreements.join(" · ") : "None"
    );
    card.append(details);
    if (verification.synthetic) {
      const warning = document.createElement("p");
      warning.className = "reviewer-authority-synthetic-warning";
      warning.textContent =
        "Synthetic fixture only · no real reviewer expertise or human authority";
      card.append(warning);
    }
    list.append(card);
  }
  root.append(list);
  container.replaceChildren(root);
  return projection;
}

function definition(document: Document, list: HTMLDListElement, term: string, value: string): void {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  list.append(dt, dd);
}

function formatRef(reference: { id: string; digest: string }): string {
  return `${reference.id} · ${reference.digest}`;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function validityLabel(
  projection: Extract<ReviewerAuthorityWorkbenchProjection, { state: "configured" }>
): string {
  return `${projection.policy.validFrom} through ${projection.policy.validUntil ?? "no fixed end"}`;
}

function scopeLabel(scope: {
  roles: string[];
  subjectKinds: string[];
  actions: string[];
  artifactCount: number;
  applicabilityCount: number;
  dimensions: string[];
  advisoryKinds: string[];
}): string {
  return [
    `roles ${scope.roles.map(humanize).join(", ") || "none"}`,
    `subjects ${scope.subjectKinds.map(humanize).join(", ") || "none"}`,
    `actions ${scope.actions.map(humanize).join(", ") || "none"}`,
    `${scope.artifactCount} artifact ref${scope.artifactCount === 1 ? "" : "s"}`,
    `${scope.applicabilityCount} applicability ref${scope.applicabilityCount === 1 ? "" : "s"}`,
    `dimensions ${scope.dimensions.map(humanize).join(", ") || "none"}`,
    `advisories ${scope.advisoryKinds.map(humanize).join(", ") || "none"}`,
  ].join(" · ");
}
