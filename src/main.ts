import { Agent, streamProxy } from "@mariozechner/pi-agent-core";
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
import { buildSystemPrompt } from "./prompts.js";
import { registerRenderers } from "./renderers.js";
import { analyzeTool, compileTool, lintTool } from "./server-tools.js";
import { tabulateTool, voicingsTool, checkPlayabilityTool, theoryTool } from "./tools.js";
import { transposeTool } from "./transpose.js";

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

export const vellumTools: AgentTool[] = [
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  theoryTool,
  compileTool,
  analyzeTool,
  lintTool,
  transposeTool,
  diapasonsTool,
  fretboardTool,
];

export function createStreamFn(): StreamFn {
  return (model, context, options) =>
    streamProxy(model, context, {
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

function markArtifactsPanelReady(): void {
  const artifactsPanel = document.querySelector<HTMLDivElement>("#artifacts-panel");
  if (artifactsPanel) {
    artifactsPanel.dataset.ready = "true";
  }
}

export async function main(): Promise<void> {
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
  installActivityIndicator(agent);
  refreshChatPanelWhenAgentSettles(agent, chatPanel);
  markArtifactsPanelReady();
}

if (typeof document !== "undefined") {
  main().catch((error: unknown) => {
    console.error("Vellum failed to initialize.", error);
  });
}
