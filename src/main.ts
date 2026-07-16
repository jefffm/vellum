import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
  AppStorage,
  ChatPanel,
  CustomProvidersStore,
  IndexedDBStorageBackend,
  ProviderKeysStore,
  SessionsStore,
  SettingsStore,
  setAppStorage,
} from "@mariozechner/pi-web-ui";
import "@mariozechner/pi-web-ui/app.css";
import type { AgentEvent, AgentTool, StreamFn } from "@mariozechner/pi-agent-core";

import { diapasonsTool } from "./diapasons.js";
import { fretboardTool } from "./fretboard.js";
import { loadAllBrowserProfiles } from "./lib/browser-profiles.js";
import { assertAuthorityPathRuntime } from "./lib/authority-path-runtime.js";
import { installCompileRetryGuard } from "./lib/compile-retry-guard.js";
import { installDebugExport } from "./lib/debug-export.js";
import { buildSystemPrompt } from "./prompts.js";
import { registerRenderers } from "./renderers.js";
import { analyzeTool, compileTool, engraveTool, lintTool } from "./server-tools.js";
import {
  alfabetoLookupTool,
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  theoryTool,
} from "./tools.js";
import type { CompileResult } from "./types.js";
import type { ArrangementScore, TargetConfiguration } from "./lib/music-domain.js";
import { apiErrorFromResponse, isApiSuccess, type ApiResponse } from "./lib/api-contract.js";
import { transposeTool } from "./transpose.js";
import {
  installAudioPreviewControls,
  installAnalysisSummary,
  installArrangementPlanSummary,
  installAuditSummary,
  installCandidateComparisonControls,
  installDeliverableSummary,
  installEvaluationCard,
  installLineageSummary,
  installNotationSelection,
  installPersonalDefaultSummary,
  installPerformanceInterpretationControls,
  installSourceLineageWorkspace,
  installVersionNavigator,
  installTransformationReport,
  installGuidedStart,
  type GuidedDeliverable,
} from "./guided-start.js";
import { vellumStreamProxy } from "./lib/vellum-stream-proxy.js";
import { renderCompilePreview } from "./artifact-preview.js";
import { isCompatibleRuntimeHealth, VELLUM_API_SCHEMA_VERSION } from "./lib/runtime-contract.js";
import { completeArtifactHandoff } from "./lib/artifact-handoff.js";

export { renderCompilePreview } from "./artifact-preview.js";

import "./styles.css";

let appStorageInitialized = false;

export function initializeAppStorage(): void {
  if (appStorageInitialized) {
    return;
  }

  const settings = new SettingsStore();
  const providerKeys = new ProviderKeysStore();
  const sessions = new SessionsStore();
  const customProviders = new CustomProvidersStore();
  const backend = new IndexedDBStorageBackend({
    dbName: "vellum",
    version: 1,
    stores: [
      settings.getConfig(),
      SessionsStore.getMetadataConfig(),
      providerKeys.getConfig(),
      customProviders.getConfig(),
      sessions.getConfig(),
    ],
  });

  settings.setBackend(backend);
  providerKeys.setBackend(backend);
  customProviders.setBackend(backend);
  sessions.setBackend(backend);

  setAppStorage(new AppStorage(settings, providerKeys, sessions, customProviders, backend));
  appStorageInitialized = true;
}

assertAuthorityPathRuntime("authority.tool.descriptions-defaults", "production");
export const vellumTools: AgentTool[] = [
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  alfabetoLookupTool,
  theoryTool,
  compileTool,
  engraveTool,
  analyzeTool,
  lintTool,
  transposeTool,
  diapasonsTool,
  fretboardTool,
];

export function createStreamFn(): StreamFn {
  return (model, context, options) =>
    vellumStreamProxy(model, context, {
      ...options,
      proxyUrl: "",
      authToken: "server-managed",
    });
}

export function createAgent(): Agent {
  const instruments = loadAllBrowserProfiles();
  const systemPrompt = buildSystemPrompt(instruments);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      tools: vellumTools,
      model: getModel("openai-codex", "gpt-5.3-codex"),
    },
    streamFn: createStreamFn(),
  });

  agent.subscribe(() => {
    agent.state.messages = agent.state.messages;
  });

  return agent;
}

function resolveChatPanel(): ChatPanel | undefined {
  const existing = document.querySelector("pi-chat-panel, chat-panel");

  if (existing && hasSetAgent(existing)) {
    return existing;
  }

  const chatPanel = document.createElement("pi-chat-panel") as ChatPanel;

  if (existing) {
    existing.replaceWith(chatPanel);
  } else {
    document.querySelector("#app")?.prepend(chatPanel);
  }

  return chatPanel;
}

function hasSetAgent(element: Element): element is ChatPanel {
  return typeof (element as Partial<ChatPanel>).setAgent === "function";
}

function installActivityIndicator(agent: Agent): void {
  const indicator = document.createElement("div");
  indicator.id = "agent-activity-indicator";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `<span class="agent-activity-spinner" aria-hidden="true"></span><span class="agent-activity-label">Working…</span>`;
  document.body.append(indicator);

  const runningTools = new Set<string>();
  let hideTimer: number | undefined;

  const show = (label: string) => {
    if (hideTimer !== undefined) {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    }
    indicator.querySelector(".agent-activity-label")?.replaceChildren(label);
    indicator.dataset.active = "true";
    indicator.setAttribute("aria-hidden", "false");
  };

  const hideSoon = () => {
    hideTimer = window.setTimeout(() => {
      indicator.dataset.active = "false";
      indicator.setAttribute("aria-hidden", "true");
    }, 300);
  };

  const update = (event: AgentEvent) => {
    switch (event.type) {
      case "agent_start":
      case "turn_start":
        show("Thinking…");
        return;
      case "message_update":
        if (runningTools.size === 0) {
          show("Streaming response…");
        }
        return;
      case "tool_execution_start":
        runningTools.add(event.toolName);
        show(`Running ${event.toolName}…`);
        return;
      case "tool_execution_end":
        runningTools.delete(event.toolName);
        if (runningTools.size > 0) {
          show(`Running ${Array.from(runningTools).join(", ")}…`);
        } else if (agent.state.isStreaming) {
          show("Continuing…");
        } else {
          hideSoon();
        }
        return;
      case "agent_end":
        runningTools.clear();
        hideSoon();
        return;
    }
  };

  agent.subscribe(update);
}

function refreshChatPanelWhenAgentSettles(agent: Agent, chatPanel: ChatPanel): void {
  agent.subscribe((event) => {
    if (event.type !== "agent_end") {
      return;
    }

    window.setTimeout(() => {
      chatPanel.agentInterface?.requestUpdate();
    }, 0);
  });
}

export function installSelectionPromptBridge(chatPanel: ChatPanel): void {
  document.addEventListener("vellum-ask-selection", (event) => {
    const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
    if (typeof message !== "string" || message.trim().length === 0) return;
    void chatPanel.agentInterface?.sendMessage(message);
  });
}

function markArtifactsPanelReady(): void {
  const artifactsPanel = document.querySelector<HTMLDivElement>("#artifacts-panel");
  if (artifactsPanel) {
    artifactsPanel.dataset.ready = "true";
    if (!artifactsPanel.hasChildNodes()) {
      renderArtifactPlaceholder(artifactsPanel);
    }
  }
}

function renderArtifactPlaceholder(panel: HTMLElement): void {
  panel.replaceChildren();
  const placeholder = document.createElement("section");
  placeholder.className = "artifact-placeholder";
  placeholder.innerHTML = `
    <div class="artifact-placeholder-card">
      <div class="artifact-placeholder-icon" aria-hidden="true">♬</div>
      <h1>Score preview</h1>
      <p>Compile LilyPond to open notation here in the full-size preview panel.</p>
    </div>
  `;
  panel.append(placeholder);
}

function isCompileResult(value: unknown): value is CompileResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CompileResult>;
  return Array.isArray(candidate.errors);
}

function installCompileArtifactPreview(agent: Agent): void {
  agent.subscribe((event) => {
    if (event.type !== "tool_execution_end" || event.toolName !== "compile" || event.isError) {
      return;
    }

    const details = (event.result as { details?: unknown }).details;
    if (!isCompileResult(details) || details.errors.length > 0) {
      return;
    }

    const artifactsPanel = document.querySelector<HTMLElement>("#artifacts-panel");
    if (artifactsPanel) {
      renderCompilePreview(artifactsPanel, details);
    }
  });
}

export async function main(): Promise<void> {
  try {
    await assertCompatibleRuntime();
  } catch (error) {
    renderRuntimeContractFailure(error);
    return;
  }
  initializeAppStorage();
  registerRenderers();

  const agent = createAgent();
  const chatPanel = resolveChatPanel();

  if (!chatPanel) {
    console.error("Vellum could not find or create a ChatPanel element.");
    return;
  }

  await chatPanel.setAgent(agent, {
    onApiKeyRequired: async () => true,
    toolsFactory: () => vellumTools,
  });
  installSelectionPromptBridge(chatPanel);
  installActivityIndicator(agent);
  installCompileRetryGuard(agent);
  installDebugExport(agent);
  installCompileArtifactPreview(agent);
  refreshChatPanelWhenAgentSettles(agent, chatPanel);
  markArtifactsPanelReady();
  const artifactsPanel = document.querySelector<HTMLElement>("#artifacts-panel");
  if (artifactsPanel) {
    installArrangementVersionBridge(artifactsPanel);
    void restoreLinkedArrangement(artifactsPanel).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const failure = document.createElement("p");
      failure.className = "guided-start-error";
      failure.textContent = `Could not restore this arrangement: ${message}`;
      artifactsPanel.replaceChildren(failure);
    });
  }
  installGuidedStart({
    onComplete: (deliverables) => {
      const panel = document.querySelector<HTMLElement>("#artifacts-panel");
      if (panel) openCompletedDeliverables(panel, deliverables);
    },
  });
}

export async function assertCompatibleRuntime(request: typeof fetch = fetch): Promise<void> {
  const response = await request("/health", { cache: "no-store" });
  const health: unknown = await response.json();
  if (!response.ok || !isCompatibleRuntimeHealth(health)) {
    throw new Error(
      `The browser and local API schemas do not match (browser ${VELLUM_API_SCHEMA_VERSION}). Restart Vellum with npm run dev:all.`
    );
  }
}

function renderRuntimeContractFailure(error: unknown): void {
  const panel = document.querySelector<HTMLElement>("#artifacts-panel") ?? document.body;
  const failure = document.createElement("section");
  failure.className = "guided-start-error runtime-contract-error";
  failure.setAttribute("role", "alert");
  failure.textContent = error instanceof Error ? error.message : "The local API is incompatible.";
  panel.replaceChildren(failure);
}

export function openCompletedDeliverables(
  panel: HTMLElement,
  deliverables: GuidedDeliverable[]
): void {
  completeArtifactHandoff({
    panel,
    selected: deliverables[0],
    render: () => renderGuidedDeliverables(panel, deliverables),
  });
}

async function restoreLinkedArrangement(panel: HTMLElement): Promise<void> {
  const query = new URL(window.location.href).searchParams;
  const workspaceId = query.get("workspace");
  const arrangementId = query.get("arrangement");
  if (
    !workspaceId?.match(/^workspace\.[a-f0-9-]{16,}$/) ||
    !arrangementId?.match(/^arrangement\.[a-f0-9-]{16,}$/)
  ) {
    return;
  }
  const deliverable = await loadGuidedDeliverable(workspaceId, arrangementId);
  const parent = deliverable.parentArrangementScoreId
    ? await loadGuidedDeliverable(workspaceId, deliverable.parentArrangementScoreId)
    : undefined;
  renderGuidedDeliverables(panel, [deliverable], parent);
}

type StoredArrangement = {
  version: number;
  parentArrangementScoreId?: string;
  branchId?: string;
  editorialCommitmentIds?: string[];
  analysisRecordId: string;
  arrangementPlanId?: string;
  arrangementSearchId?: string;
  arrangementFamilyId: string;
  targetConfiguration: TargetConfiguration;
  preservationPolicy: ArrangementScore["preservationPolicy"];
  transformationReport: GuidedDeliverable["transformationReport"];
  preservationAudit: GuidedDeliverable["preservationAudit"];
  continuoDisposition?: GuidedDeliverable["continuoDisposition"];
  events: GuidedDeliverable["arrangementEvents"];
};

async function loadGuidedDeliverable(
  workspaceId: string,
  arrangementId: string
): Promise<GuidedDeliverable> {
  const arrangement = await browserApi<StoredArrangement>(
    `/api/workspaces/${workspaceId}/arrangements/${arrangementId}`
  );
  if (!arrangement.arrangementSearchId)
    throw new Error(`Arrangement Score has no persisted search: ${arrangementId}`);
  const search = await browserApi<{ id: string; candidateIds: string[] }>(
    `/api/workspaces/${workspaceId}/arrangement-searches/${arrangement.arrangementSearchId}`
  );
  const candidates = await Promise.all(
    search.candidateIds.map((candidateId) =>
      browserApi<GuidedDeliverable["candidates"][number]>(
        `/api/workspaces/${workspaceId}/arrangement-searches/${search.id}/candidates/${candidateId}`
      )
    )
  );
  if (!arrangement.arrangementPlanId)
    throw new Error(`Arrangement Score has no persisted plan: ${arrangementId}`);
  const [projections, analysis, plan, workspace] = await Promise.all([
    loadSavedProjections(workspaceId, arrangementId),
    browserApi<GuidedDeliverable["analysis"]>(
      `/api/workspaces/${workspaceId}/analyses/${arrangement.analysisRecordId}`
    ),
    browserApi<NonNullable<GuidedDeliverable["arrangementPlan"]>>(
      `/api/workspaces/${workspaceId}/arrangement-plans/${arrangement.arrangementPlanId}`
    ),
    browserApi<{
      brief: { personalDefaultApplications?: GuidedDeliverable["personalDefaultApplications"] };
    }>(`/api/workspaces/${workspaceId}`),
  ]);
  const { compiled, preview } = projections;
  return {
    workspaceId,
    arrangementScoreId: arrangementId,
    arrangementScoreVersion: arrangement.version,
    parentArrangementScoreId: arrangement.parentArrangementScoreId,
    branchId: arrangement.branchId,
    editorialCommitmentIds: arrangement.editorialCommitmentIds ?? [],
    arrangementFamilyId: arrangement.arrangementFamilyId,
    arrangementSearchId: search.id,
    arrangementPlan: plan,
    targetConfigurationId: arrangement.targetConfiguration.id,
    targetConfiguration: arrangement.targetConfiguration,
    preservationPolicy: arrangement.preservationPolicy,
    label: arrangement.targetConfiguration.instrumentId,
    arrangementEvents: arrangement.events,
    analysis,
    transformationReport: arrangement.transformationReport,
    preservationAudit: arrangement.preservationAudit,
    continuoDisposition: arrangement.continuoDisposition,
    compiled,
    preview,
    deliverables: [...compiled.deliverables, preview.deliverable],
    candidates,
    personalDefaultApplications: workspace.brief.personalDefaultApplications,
  };
}

async function loadSavedProjections(workspaceId: string, arrangementId: string) {
  try {
    return await browserApi<{
      compiled: CompileResult & { deliverables: GuidedDeliverable["deliverables"] };
      preview: import("./lib/audio-preview.js").AudioPreview & {
        deliverable: GuidedDeliverable["deliverables"][number];
      };
    }>(`/api/workspaces/${workspaceId}/arrangements/${arrangementId}/restore`);
  } catch {
    const [compiled, preview] = await Promise.all([
      browserApi<CompileResult & { deliverables: GuidedDeliverable["deliverables"] }>(
        `/api/workspaces/${workspaceId}/arrangements/${arrangementId}/compile`,
        { method: "POST" }
      ),
      browserApi<
        import("./lib/audio-preview.js").AudioPreview & {
          deliverable: GuidedDeliverable["deliverables"][number];
        }
      >(`/api/workspaces/${workspaceId}/arrangements/${arrangementId}/audio-preview`),
    ]);
    return { compiled, preview };
  }
}

function installArrangementVersionBridge(panel: HTMLElement): void {
  const open = async (
    workspaceId: string,
    arrangementId: string,
    comparisonArrangementScoreId?: string
  ) => {
    const current = await loadGuidedDeliverable(workspaceId, arrangementId);
    const comparisonId = comparisonArrangementScoreId ?? current.parentArrangementScoreId;
    const comparison = comparisonId
      ? await loadGuidedDeliverable(workspaceId, comparisonId)
      : undefined;
    renderGuidedDeliverables(panel, [current], comparison);
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", workspaceId);
    url.searchParams.set("arrangement", arrangementId);
    window.history.pushState({}, "", url);
  };
  document.addEventListener("vellum-arrangement-version-created", (event) => {
    const detail = (
      event as CustomEvent<{
        result?: { arrangementScore?: { id?: unknown } };
        deliverable?: { workspaceId?: unknown };
      }>
    ).detail;
    const arrangementId = detail?.result?.arrangementScore?.id;
    const workspaceId = detail?.deliverable?.workspaceId;
    if (typeof arrangementId === "string" && typeof workspaceId === "string")
      void open(workspaceId, arrangementId);
  });
  document.addEventListener("vellum-open-arrangement-version", (event) => {
    const detail = (
      event as CustomEvent<{
        arrangementScoreId?: unknown;
        comparisonArrangementScoreId?: unknown;
        workspaceId?: unknown;
      }>
    ).detail;
    const arrangementId = detail?.arrangementScoreId;
    const comparisonId = detail?.comparisonArrangementScoreId;
    const workspaceId =
      typeof detail?.workspaceId === "string"
        ? detail.workspaceId
        : new URL(window.location.href).searchParams.get("workspace");
    if (typeof arrangementId === "string" && workspaceId)
      void open(
        workspaceId,
        arrangementId,
        typeof comparisonId === "string" ? comparisonId : undefined
      );
  });
  window.addEventListener("popstate", () => {
    void restoreLinkedArrangement(panel);
  });
}

async function browserApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const envelope = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !isApiSuccess<T>(envelope))
    throw apiErrorFromResponse(response.status, envelope);
  return envelope.data;
}

function renderGuidedDeliverables(
  panel: HTMLElement,
  deliverables: GuidedDeliverable[],
  versionParent?: GuidedDeliverable
): void {
  const render = (deliverable: GuidedDeliverable) => {
    if (!renderCompilePreview(panel, deliverable.compiled)) return;
    panel.dataset.workspaceId = deliverable.workspaceId;
    panel.dataset.arrangementId = deliverable.arrangementScoreId;
    panel.dataset.arrangementVersion = String(deliverable.arrangementScoreVersion);
    const header = panel.querySelector<HTMLElement>(".artifact-preview-header");
    if (header && deliverables.length > 1) {
      const label = document.createElement("label");
      label.className = "artifact-output-selector";
      label.textContent = "Output";
      const select = document.createElement("select");
      for (const [index, option] of deliverables.entries()) {
        const element = document.createElement("option");
        element.value = String(index);
        element.textContent = option.label;
        element.selected = option === deliverable;
        select.append(element);
      }
      select.addEventListener("change", () => render(deliverables[Number(select.value)]!));
      label.append(select);
      header.append(label);
    }
    installAudioPreviewControls(panel, deliverable.preview);
    installNotationSelection(panel, deliverable);
    installSourceLineageWorkspace(panel, deliverable);
    installVersionNavigator(panel, deliverable, versionParent);
    installAnalysisSummary(panel, deliverable);
    installAuditSummary(panel, deliverable);
    installArrangementPlanSummary(panel, deliverable);
    installPersonalDefaultSummary(panel, deliverable);
    void installPerformanceInterpretationControls(panel, deliverable);
    installDeliverableSummary(panel, deliverable);
    void installEvaluationCard(panel, deliverable).catch((error: unknown) => {
      console.warn("Evaluation Card is unavailable for this score version.", error);
    });
    void installLineageSummary(panel, deliverable);
    installTransformationReport(panel, deliverable);
    installCandidateComparisonControls(panel, deliverable);
  };
  if (deliverables[0]) render(deliverables[0]);
}

if (typeof document !== "undefined") {
  main().catch((error: unknown) => {
    console.error("Vellum failed to initialize.", error);
  });
}
