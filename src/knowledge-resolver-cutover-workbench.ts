import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
const Digest = Type.String({ pattern: "^[a-f0-9]{64}$" });
const Ref = Type.Object({
  id: Type.String({ minLength: 1 }),
  digest: Digest,
});
const GenerationRef = Type.Object({
  id: Type.String({ minLength: 1 }),
  digest: Digest,
  revision: Type.Integer({ minimum: 1 }),
});
const PreflightSchema = Type.Object({
  recordKind: Type.Literal("knowledge_resolver_preflight"),
  schemaVersion: Type.Literal(1),
  id: Type.String({ minLength: 1 }),
  basePublicationGenerationRef: GenerationRef,
  checks: Type.Array(
    Type.Object({
      check: Type.String({ minLength: 1 }),
      status: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
      evidenceRefs: Type.Array(Ref),
      reasonCode: Type.String({ minLength: 1 }),
    })
  ),
  result: Type.Union([Type.Literal("pass"), Type.Literal("fail")]),
  legacyBehaviorDigest: Digest,
  completeManifestBehaviorDigest: Digest,
  shadowDeltaDigest: Digest,
  rollbackStateDigest: Digest,
  projection: Type.Unknown(),
  checkedAt: Type.String({ minLength: 1 }),
  digest: Digest,
});
type KnowledgeResolverPreflight = Static<typeof PreflightSchema>;
const ActiveSchema = Type.Union([
  Type.Object({
    mode: Type.Literal("legacy"),
    legacyActivationEnabled: Type.Literal(true),
    completeManifestResolverEnabled: Type.Literal(false),
    activeAuthorityHeadRef: Ref,
    publicationGenerationRef: GenerationRef,
    controlStateRef: Type.Union([Ref, Type.Null()]),
  }),
  Type.Object({
    mode: Type.Literal("complete_manifest"),
    legacyActivationEnabled: Type.Literal(false),
    completeManifestResolverEnabled: Type.Literal(true),
    activeAuthorityHeadRef: Ref,
    cutoverProofManifestRef: Ref,
    activeExecutionIdentity: Type.Unknown(),
    publicationGenerationRef: GenerationRef,
    controlStateRef: Ref,
  }),
]);
const StateSchema = Type.Object({
  active: ActiveSchema,
  preflight: Type.Optional(PreflightSchema),
});
type State = Static<typeof StateSchema>;

export type KnowledgeResolverCutoverAction = (
  request:
    | { action: "preflight" }
    | {
        action: "cutover";
        expectedHead: State["active"]["publicationGenerationRef"];
        preflight: KnowledgeResolverPreflight;
      }
    | {
        action: "rollback";
        expectedHead: State["active"]["publicationGenerationRef"];
      }
) => Promise<unknown>;

export function renderKnowledgeResolverCutoverWorkbench(
  container: HTMLElement,
  value: unknown,
  action: KnowledgeResolverCutoverAction
): State {
  assertAuthorityPathRuntime("authority.presentation.claim-labels", "production");
  const state = Value.Decode(StateSchema, value) as State;
  const document = container.ownerDocument;
  const root = document.createElement("div");
  root.className = "knowledge-resolver-cutover-workbench";
  const heading = document.createElement("h3");
  heading.textContent = "Resolver authority cutover";
  const status = document.createElement("p");
  status.className = "knowledge-resolver-authority-status";
  status.textContent =
    state.active.mode === "legacy"
      ? "Legacy authority is active; complete-manifest activation is disabled."
      : "Complete-manifest authority is active; legacy activation is disabled.";
  root.append(heading, status);

  const xor = document.createElement("p");
  xor.textContent = `Authority invariant: legacy ${state.active.legacyActivationEnabled ? "on" : "off"} · complete manifest ${state.active.completeManifestResolverEnabled ? "on" : "off"}`;
  root.append(xor);

  if (state.preflight) {
    const checks = document.createElement("ul");
    checks.className = "knowledge-resolver-preflight-checks";
    for (const check of state.preflight.checks) {
      const item = document.createElement("li");
      item.textContent = `${humanize(check.check)}: ${check.status}`;
      checks.append(item);
    }
    root.append(checks);
  }

  const controls = document.createElement("div");
  controls.className = "knowledge-resolver-cutover-controls";
  const operationStatus = document.createElement("p");
  operationStatus.setAttribute("role", "status");
  const invoke = async (request: Parameters<KnowledgeResolverCutoverAction>[0]) => {
    for (const button of controls.querySelectorAll("button")) button.disabled = true;
    operationStatus.textContent = "Applying transactional resolver operation…";
    try {
      const updated = await action(request);
      renderKnowledgeResolverCutoverWorkbench(container, updated, action);
    } catch (error) {
      operationStatus.textContent =
        error instanceof Error ? error.message : "Resolver operation failed.";
      for (const button of controls.querySelectorAll("button")) button.disabled = false;
    }
  };
  if (state.active.mode === "legacy") {
    const preflight = button(document, "Run cutover preflight");
    preflight.addEventListener("click", () => void invoke({ action: "preflight" }));
    controls.append(preflight);
    if (state.preflight?.result === "pass") {
      const cutover = button(document, "Activate complete-manifest resolver");
      cutover.addEventListener(
        "click",
        () =>
          void invoke({
            action: "cutover",
            expectedHead: state.active.publicationGenerationRef,
            preflight: state.preflight!,
          })
      );
      controls.append(cutover);
    }
  } else {
    const rollback = button(document, "Roll back to exact prior authority");
    rollback.addEventListener(
      "click",
      () => void invoke({ action: "rollback", expectedHead: state.active.publicationGenerationRef })
    );
    controls.append(rollback);
  }
  controls.append(operationStatus);
  root.append(controls);
  container.replaceChildren(root);
  return state;
}

function button(document: Document, label: string): HTMLButtonElement {
  const value = document.createElement("button");
  value.type = "button";
  value.textContent = label;
  return value;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
