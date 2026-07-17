import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
import type {
  KnowledgeResolutionMode,
  KnowledgeResolutionProjection,
} from "./lib/knowledge-resolution-contract.js";

const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const Ref = Type.Object({ id: Type.String({ minLength: 1 }), digest: Digest });
const Mode = Type.Union([
  Type.Literal("ordinary_default"),
  Type.Literal("provisional_research"),
  Type.Literal("isolated_evaluation"),
]);
const WorkbenchProjectionSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  mode: Mode,
  publicationGenerationRef: Type.Object({
    id: Type.String({ minLength: 1 }),
    digest: Digest,
    revision: Type.Integer({ minimum: 1 }),
  }),
  inventory: Type.Object({
    id: Type.String({ minLength: 1 }),
    digest: Digest,
    allReleaseRefs: Type.Array(Ref),
  }),
  outcomes: Type.Array(
    Type.Object({
      state: Type.Union([
        Type.Literal("eligible"),
        Type.Literal("excluded"),
        Type.Literal("conflicting"),
        Type.Literal("retracted"),
        Type.Literal("unavailable_source"),
        Type.Literal("inapplicable"),
        Type.Literal("unknown"),
      ]),
    })
  ),
  catalog: Ref,
  policy: Ref,
  componentRegistry: Type.Object({
    id: Type.String({ minLength: 1 }),
    digest: Digest,
    authorityPathOutcomes: Type.Array(Type.Unknown()),
  }),
  manifest: Type.Object({
    id: Type.String({ minLength: 1 }),
    digest: Digest,
    entries: Type.Array(Type.Unknown()),
  }),
  consequences: Type.Array(
    Type.Object({
      courseMappings: Type.Array(
        Type.Object({ course: Type.Integer({ minimum: 1 }), sign: Type.String({ minLength: 1 }) })
      ),
      course13Disposition: Type.Literal("unresolved_no_mapping"),
      presentation: Type.Literal("provisional_research_only"),
      readinessClaim: Type.Literal(false),
    })
  ),
  executionIdentity: Type.Unknown(),
  authorityReadiness: Type.Object({
    schemaVersion: Type.Literal(1),
    authorityLane: Type.String({ minLength: 1 }),
    authorityState: Type.String({ minLength: 1 }),
    activationState: Type.String({ minLength: 1 }),
    releaseState: Type.String({ minLength: 1 }),
    qualificationState: Type.String({ minLength: 1 }),
    readinessState: Type.String({ minLength: 1 }),
    historicalPresentation: Type.String({ minLength: 1 }),
    syntheticEvidencePresent: Type.Boolean(),
    reasonCode: Type.String({ minLength: 1 }),
  }),
  ordinaryActivation: Type.Literal(false),
  readinessClaim: Type.Literal(false),
});

export type KnowledgeResolutionAction = (
  mode: KnowledgeResolutionMode,
  expectedHead?: KnowledgeResolutionProjection["publicationGenerationRef"]
) => Promise<unknown>;

export function renderKnowledgeResolutionWorkbench(
  container: HTMLElement,
  value: unknown,
  action?: KnowledgeResolutionAction
): KnowledgeResolutionProjection {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const projection = Value.Decode(
    WorkbenchProjectionSchema,
    value
  ) as unknown as KnowledgeResolutionProjection;
  const document = container.ownerDocument;
  const root = document.createElement("div");
  root.className = "knowledge-resolution-workbench";

  const heading = document.createElement("h3");
  heading.textContent = "Applied knowledge resolution";
  const boundary = document.createElement("p");
  boundary.className = "knowledge-resolution-boundary";
  boundary.textContent =
    "Default Guided Start never activates test-only research. Provisional research is an explicit, inspectable preview and cannot claim arrangement readiness.";
  root.append(heading, boundary);

  if (action) root.append(renderControls(document, projection, action));

  const summary = document.createElement("dl");
  summary.className = "knowledge-resolution-summary";
  definition(document, summary, "Mode", humanize(projection.mode));
  definition(
    document,
    summary,
    "Publication generation",
    `r${projection.publicationGenerationRef.revision} · ${formatRef(projection.publicationGenerationRef)}`
  );
  definition(document, summary, "Inventory", formatRef(projection.inventory));
  definition(document, summary, "Catalog", formatRef(projection.catalog));
  definition(document, summary, "Resolution policy", formatRef(projection.policy));
  definition(document, summary, "Component registry", formatRef(projection.componentRegistry));
  definition(document, summary, "Applied manifest", formatRef(projection.manifest));
  definition(
    document,
    summary,
    "Closure",
    `${projection.inventory.allReleaseRefs.length} release(s) · ${projection.outcomes.length} outcome(s) · ${projection.manifest.entries.length} profile entry/entries · ${projection.componentRegistry.authorityPathOutcomes.length} authority paths`
  );
  definition(
    document,
    summary,
    "Authority lane",
    humanize(projection.authorityReadiness.authorityLane)
  );
  definition(
    document,
    summary,
    "Authority state",
    humanize(projection.authorityReadiness.authorityState)
  );
  definition(
    document,
    summary,
    "Activation",
    humanize(projection.authorityReadiness.activationState)
  );
  definition(
    document,
    summary,
    "Release state",
    humanize(projection.authorityReadiness.releaseState)
  );
  definition(
    document,
    summary,
    "Qualification",
    humanize(projection.authorityReadiness.qualificationState)
  );
  definition(
    document,
    summary,
    "Target readiness",
    humanize(projection.authorityReadiness.readinessState)
  );
  definition(
    document,
    summary,
    "Historical presentation",
    humanize(projection.authorityReadiness.historicalPresentation)
  );
  root.append(summary);

  const states = document.createElement("p");
  states.className = "knowledge-resolution-states";
  states.textContent = projection.outcomes.length
    ? `Inventory outcomes: ${projection.outcomes.map(({ state }) => humanize(state)).join(", ")}`
    : "Inventory outcomes: no releases are present.";
  root.append(states);

  if (projection.mode === "ordinary_default") {
    const inactive = document.createElement("p");
    inactive.className = "knowledge-resolution-inactive";
    inactive.textContent =
      "Default Guided Start: test-only knowledge is inactive. No provisional consequence is applied.";
    root.append(inactive);
  } else {
    root.append(renderProvisionalConsequences(document, projection));
  }

  const identity = document.createElement("details");
  identity.className = "knowledge-resolution-identity";
  const identitySummary = document.createElement("summary");
  identitySummary.textContent = "Exact execution identity";
  const identityBody = document.createElement("pre");
  identityBody.textContent = JSON.stringify(projection.executionIdentity, null, 2);
  identity.append(identitySummary, identityBody);
  root.append(identity);

  container.replaceChildren(root);
  return projection;
}

function renderControls(
  document: Document,
  projection: KnowledgeResolutionProjection,
  action: KnowledgeResolutionAction
): HTMLElement {
  const form = document.createElement("form");
  form.className = "knowledge-resolution-controls";
  const label = document.createElement("label");
  label.textContent = "Resolution mode";
  const select = document.createElement("select");
  select.name = "knowledge-resolution-mode";
  select.setAttribute("aria-label", "Knowledge resolution mode");
  for (const mode of ["ordinary_default", "provisional_research", "isolated_evaluation"] as const) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = humanize(mode);
    option.selected = projection.mode === mode;
    select.append(option);
  }
  label.append(select);
  const preview = document.createElement("button");
  preview.type = "button";
  preview.textContent = "Preview resolution";
  const publish = document.createElement("button");
  publish.type = "button";
  publish.textContent = "Publish inspected resolution";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const run = async (publishResult: boolean) => {
    preview.disabled = true;
    publish.disabled = true;
    status.textContent = publishResult ? "Publishing exact resolution…" : "Building preview…";
    try {
      await action(
        select.value as KnowledgeResolutionMode,
        publishResult ? projection.publicationGenerationRef : undefined
      );
      status.textContent = publishResult ? "Resolution published." : "Preview rebuilt.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Resolution failed.";
    } finally {
      preview.disabled = false;
      publish.disabled = false;
    }
  };
  preview.addEventListener("click", () => void run(false));
  publish.addEventListener("click", () => void run(true));
  form.append(label, preview, publish, status);
  return form;
}

function renderProvisionalConsequences(
  document: Document,
  projection: KnowledgeResolutionProjection
): HTMLElement {
  const section = document.createElement("section");
  section.className = "knowledge-resolution-provisional";
  const heading = document.createElement("h4");
  heading.textContent = "Provisional research consequence";
  section.append(heading);
  if (projection.consequences.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No eligible test-only consequence matched the exact research scope.";
    section.append(empty);
    return section;
  }
  for (const consequence of projection.consequences) {
    const mapping = document.createElement("p");
    mapping.className = "knowledge-resolution-mapping";
    mapping.textContent = consequence.courseMappings
      .map(({ course, sign }) => `${course}: ${sign}`)
      .join(" · ");
    const unresolved = document.createElement("p");
    unresolved.textContent = "Course 13: unresolved — no mapping applied · readiness not claimed";
    section.append(mapping, unresolved);
  }
  return section;
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
