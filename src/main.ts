import { Agent, streamProxy } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { ChatPanel } from "@mariozechner/pi-web-ui";
import type { AgentTool, StreamFn } from "@mariozechner/pi-agent-core";

import { diapasonsTool } from "./diapasons.js";
import { fretboardTool } from "./fretboard.js";
import { loadAllBrowserProfiles } from "./lib/browser-profiles.js";
import { buildSystemPrompt } from "./prompts.js";
import { registerRenderers } from "./renderers.js";
import { analyzeTool, compileTool, lintTool } from "./server-tools.js";
import { tabulateTool, voicingsTool, checkPlayabilityTool, theoryTool } from "./tools.js";
import { transposeTool } from "./transpose.js";

import "./styles.css";

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

  return new Agent({
    initialState: {
      systemPrompt,
      tools: vellumTools,
      model: getModel("anthropic", "claude-sonnet-4-20250514"),
    },
    streamFn: createStreamFn(),
  });
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

function markArtifactsPanelReady(): void {
  const artifactsPanel = document.querySelector<HTMLDivElement>("#artifacts-panel");
  if (artifactsPanel) {
    artifactsPanel.dataset.ready = "true";
  }
}

export async function main(): Promise<void> {
  registerRenderers();

  const agent = createAgent();
  const chatPanel = resolveChatPanel();

  if (!chatPanel) {
    console.error("Vellum could not find or create a ChatPanel element.");
    return;
  }

  await chatPanel.setAgent(agent);
  markArtifactsPanelReady();
}

if (typeof document !== "undefined") {
  main().catch((error: unknown) => {
    console.error("Vellum failed to initialize.", error);
  });
}
