# Wave 10 — Browser Wiring: Agent + Tool Renderers

## Scope

2 beads that make Vellum work in a browser. After this wave, you can open the app, chat with the LLM, and see compiled notation inline.

| #   | Bead         | Title                         | Pri |
| --- | ------------ | ----------------------------- | --- |
| 1   | l88.3        | Agent wiring (main.ts)        | P0  |
| 2   | l88.2        | Tool renderers (renderers.ts) | P1  |
| —   | housekeeping | Close parent epics d0c, gwf   | —   |

---

## Environment Setup

Bootstrap Nix (required every session):

```bash
mkdir -p /nix 2>/dev/null
curl -L https://nixos.org/nix/install 2>/dev/null | bash -s -- --no-daemon 2>&1
groupadd nixbld 2>/dev/null
mkdir -p /etc/nix
cat > /etc/nix/nix.conf << 'EOF'
build-users-group =
experimental-features = nix-command flakes
sandbox = false
EOF
NIX=$(find /nix/store -maxdepth 1 -name "*-nix-*" -type d | head -1)
mkdir -p ~/bin && ln -sf $NIX/bin/nix ~/bin/nix
export PATH="$HOME/bin:$PATH"
```

Run all commands via the dev shell:

```bash
cd ~/workspace/vellum && nix develop --command bash -c 'npm install && npm run typecheck && npm test'
```

**Gate:** All existing tests (250 across 27 files) must pass before AND after changes.

---

## Housekeeping: Close Parent Epics

Update `.beads/issues.jsonl` — set status to `"closed"` for these parent epics where all children are done:

| Bead       | Title                                | Why                                                  |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| vellum-d0c | Epic 5: Express Server Core          | All sub-beads closed (d0c.4, d0c.5 closed in wave 9) |
| vellum-gwf | Epic 6: LilyPond Compilation Service | All sub-beads closed (gwf.3, gwf.4 closed in wave 9) |

---

## Bead 1: l88.3 — Agent Wiring (main.ts)

Read the full bead: `grep '"id":"vellum-l88.3"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Rewrite `src/main.ts` from the current stub into the full browser entry point.

### Current state

```typescript
// src/main.ts (current stub)
import "@mariozechner/pi-web-ui";
import "./styles.css";

const artifactsPanel = document.querySelector<HTMLDivElement>("#artifacts-panel");
if (artifactsPanel) {
  artifactsPanel.dataset.ready = "true";
}
```

### Target state

```typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { streamProxy } from "@mariozechner/pi-agent-core";
import { ChatPanel } from "@mariozechner/pi-web-ui";
import type { AgentTool, StreamFn } from "@mariozechner/pi-agent-core";
import type { InstrumentProfile } from "./types.js";

import { buildSystemPrompt } from "./prompts.js";
import { loadAllBrowserProfiles } from "./lib/browser-profiles.js";
import { tools } from "./tools.js"; // Pre-assembled array of all 10 tools
import { registerRenderers } from "./renderers.js";

import "./styles.css";

async function main() {
  // 1. Load instrument profiles (browser-side, from YAML via Vite ?raw)
  const instruments = loadAllBrowserProfiles();

  // 2. Build system prompt
  const systemPrompt = buildSystemPrompt(instruments);

  // 3. Register tool renderers
  registerRenderers();

  // 5. Create stream function (proxy through server)
  const streamFn: StreamFn = (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      proxyUrl: "/api/stream",
      authToken: "server-managed",
    });

  // 6. Create Agent
  const agent = new Agent({
    initialState: {
      systemPrompt,
      tools,
      model: { provider: "anthropic", id: "claude-sonnet-4-20250514" },
    },
    streamFn,
  });

  // 7. Wire ChatPanel
  const chatPanel = document.querySelector("chat-panel") as ChatPanel;
  if (chatPanel) {
    await chatPanel.setAgent(agent);
  }
}

main().catch(console.error);
```

### Key implementation details

#### Stream proxy

The server's `POST /api/stream` route handles LLM API key resolution from environment variables. The browser sends the model provider/id and message context; the server adds the API key and proxies to the LLM.

Use `streamProxy` from `@mariozechner/pi-agent-core`. It:

- POSTs `{ model, context, options }` to the `proxyUrl`
- Reads Server-Sent Events back
- Returns an async iterable of `AssistantMessageEvent`

The `authToken` parameter is required by the type but our server doesn't check it — pass `"server-managed"` or any non-empty string.

**Important:** In dev mode, Vite proxies `/api/*` to `http://localhost:3000` (configured in `vite.config.ts`). In production, the Express server serves the built frontend from `dist/` and handles API routes directly. No CORS issues in either case.

#### Tool imports

The tools are split across multiple files. The bead description references `voicingsTool` and `checkPlayabilityTool` — verify the actual export names in `src/tools.ts`:

```bash
grep 'export const.*Tool' src/tools.ts
```

The tool exports may be named differently (e.g., `voicingsTool` vs `voicings_tool`). Use whatever names are actually exported.

#### Model default

Set a sensible default model in `initialState.model`. Use `{ provider: "anthropic", id: "claude-sonnet-4-20250514" }` — the ChatPanel UI lets the user change models, but we need a default. The model selection is displayed in the chat UI.

**Note:** If `claude-sonnet-4-20250514` doesn't exist yet in the model registry, check what Anthropic model IDs the library supports. Common alternatives: `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022`. Pick whichever is the latest Sonnet available.

#### ChatPanel.setAgent

The `ChatPanel` is a Lit web component (already in `index.html` as `<chat-panel>`). It has a `setAgent(agent, config?)` method. The config is optional — the minimal call is just `chatPanel.setAgent(agent)`.

Optional config properties:

- `onApiKeyRequired?: (provider: string) => Promise<boolean>` — called when the stream proxy returns a 500 (no API key). Could show a prompt. For now, omit.
- `toolsFactory?` — creates additional tools. Not needed (we pass tools via Agent).

#### Error handling

Wrap `main()` in try/catch. If profile loading fails or the ChatPanel element isn't found, log a clear error to the console. Don't crash silently.

### HTML (no changes needed)

The existing `index.html` already has:

```html
<chat-panel></chat-panel>
<div id="artifacts-panel" aria-label="Artifacts panel"></div>
<script type="module" src="/src/main.ts"></script>
```

### CSS (minimal updates)

The existing `src/styles.css` has the grid layout. May need minor tweaks for the ChatPanel sizing. The ChatPanel component has its own internal styles, so the outer grid just needs to give it enough space.

### Tests

**File:** `src/main.test.ts`

This is a browser entry point — limited testability without a real browser. Focus on what CAN be tested in Node/Vitest:

```
- All 10 tool imports resolve without errors
- buildSystemPrompt(loadAllBrowserProfiles()) returns a non-empty string
- Tool names are unique (no duplicates in the tools array)
- All tools have name, description, parameters, and execute
```

Do NOT test ChatPanel rendering (needs browser DOM with Lit). The browser verification is manual or via Playwright (future).

### Acceptance criteria

- [ ] main.ts creates Agent with all 10 tools
- [ ] System prompt is built from browser profiles
- [ ] Stream function proxies through /api/stream
- [ ] ChatPanel.setAgent is called
- [ ] Vite dev server starts without errors (`npx vite --host 0.0.0.0`)
- [ ] Vite build succeeds (`npx vite build`)
- [ ] Typecheck passes

---

## Bead 2: l88.2 — Tool Renderers (renderers.ts)

Read the full bead: `grep '"id":"vellum-l88.2"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Create `src/renderers.ts` — custom visual renderers for tool results in the chat stream.

### API reference

The renderer API from `@mariozechner/pi-web-ui`:

```typescript
import { registerToolRenderer } from "@mariozechner/pi-web-ui";
import type { ToolRenderer, ToolRenderResult } from "@mariozechner/pi-web-ui";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

// ToolRenderer interface:
interface ToolRenderer<TParams = any, TDetails = any> {
  render(
    params: TParams | undefined,
    result: ToolResultMessage<TDetails> | undefined,
    isStreaming?: boolean
  ): ToolRenderResult;
}

// ToolRenderResult:
interface ToolRenderResult {
  content: TemplateResult; // Lit html`` tagged template
  isCustom: boolean; // true = use this rendering, false = fall back to default JSON
}
```

**Important:** Renderers use Lit's `html` tagged template literal, NOT raw DOM. You need:

```typescript
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
```

### Renderers to implement

#### 1. compile renderer

The compile tool returns `CompileResult` as `details`:

```typescript
interface CompileResult {
  svg?: string; // Raw SVG markup (can be very large)
  pdf?: string; // Base64 PDF
  midi?: string; // Base64 MIDI
  errors: CompileError[];
  barCount?: number;
  voiceCount?: number;
}
```

**Renderer behavior:**

- If `result.details.svg` exists and errors are empty: render the SVG inline in a scrollable container
- If errors exist: render error list with line numbers
- While streaming (`isStreaming === true`): show a "Compiling..." placeholder
- Fallback: return `{ content, isCustom: false }` for default rendering

```typescript
registerToolRenderer("compile", {
  render(params, result, isStreaming) {
    if (isStreaming) {
      return { content: html`<div class="tool-status">Compiling…</div>`, isCustom: true };
    }

    if (!result?.details) {
      return { content: html``, isCustom: false };
    }

    const details = result.details as CompileResult;

    if (details.errors.length > 0) {
      return {
        content: html`
          <div class="compile-errors">
            <strong>${details.errors.length} error(s):</strong>
            <ul>
              ${details.errors.map((e) => html`<li>Line ${e.line}: ${e.message}</li>`)}
            </ul>
          </div>
        `,
        isCustom: true,
      };
    }

    if (details.svg) {
      return {
        content: html`
          <div
            class="compile-result"
            style="overflow-x:auto; max-width:100%; border:1px solid #e0e0e0; border-radius:8px; padding:12px; background:#fff;"
          >
            ${unsafeHTML(details.svg)}
          </div>
        `,
        isCustom: true,
      };
    }

    return { content: html``, isCustom: false };
  },
});
```

#### 2. fretboard renderer

The fretboard tool returns `{ svg: string }` as details.

```typescript
registerToolRenderer("fretboard", {
  render(params, result, isStreaming) {
    if (isStreaming) {
      return { content: html`<div class="tool-status">Drawing fretboard…</div>`, isCustom: true };
    }

    const svg = (result?.details as any)?.svg;
    if (typeof svg === "string" && svg.length > 0) {
      return {
        content: html`
          <div
            class="fretboard-result"
            style="max-width:320px; padding:8px; border:1px solid #e0e0e0; border-radius:8px; background:#fff;"
          >
            ${unsafeHTML(svg)}
          </div>
        `,
        isCustom: true,
      };
    }

    return { content: html``, isCustom: false };
  },
});
```

#### 3. check_playability renderer

The check_playability tool returns `PlayabilityResult` as details:

```typescript
interface PlayabilityResult {
  violations: Violation[];
  difficulty: "beginner" | "intermediate" | "advanced";
  flagged_bars: number[];
}
```

```typescript
registerToolRenderer("check_playability", {
  render(params, result, isStreaming) {
    if (isStreaming) {
      return {
        content: html`<div class="tool-status">Checking playability…</div>`,
        isCustom: true,
      };
    }

    const details = result?.details as PlayabilityResult | undefined;
    if (!details) {
      return { content: html``, isCustom: false };
    }

    const difficultyColors = {
      beginner: "#4caf50",
      intermediate: "#ff9800",
      advanced: "#f44336",
    };
    const color = difficultyColors[details.difficulty] ?? "#999";

    if (details.violations.length === 0) {
      return {
        content: html`
          <div
            class="playability-result"
            style="padding:8px 12px; border:1px solid #e0e0e0; border-radius:8px;"
          >
            <span style="color:#4caf50; font-weight:600;">✓ Playable</span>
            <span
              style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.85em; color:#fff; background:${color}; margin-left:8px;"
            >
              ${details.difficulty}
            </span>
          </div>
        `,
        isCustom: true,
      };
    }

    return {
      content: html`
        <div
          class="playability-result"
          style="padding:8px 12px; border:1px solid #e0e0e0; border-radius:8px;"
        >
          <div style="margin-bottom:6px;">
            <span style="color:#f44336; font-weight:600;"
              >⚠ ${details.violations.length} issue(s)</span
            >
            <span
              style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.85em; color:#fff; background:${color}; margin-left:8px;"
            >
              ${details.difficulty}
            </span>
          </div>
          <ul style="margin:0; padding-left:20px; font-size:0.9em;">
            ${details.violations.map((v) => html`<li>Bar ${v.bar}: ${v.description}</li>`)}
          </ul>
        </div>
      `,
      isCustom: true,
    };
  },
});
```

### Export

`src/renderers.ts` should export a single `registerRenderers()` function that calls all three `registerToolRenderer()` calls. This function is called once from `main.ts` during initialization.

```typescript
// src/renderers.ts
export function registerRenderers(): void {
  // register compile renderer
  // register fretboard renderer
  // register check_playability renderer
}
```

### Tests

**File:** `src/renderers.test.ts`

Testing Lit template output in Node is possible but awkward. Focus on:

```
- registerRenderers() can be called without throwing
- After calling registerRenderers(), getToolRenderer("compile") returns a renderer
- After calling registerRenderers(), getToolRenderer("fretboard") returns a renderer
- After calling registerRenderers(), getToolRenderer("check_playability") returns a renderer
- Compile renderer with SVG details returns isCustom: true
- Compile renderer with no details returns isCustom: false
- Check playability renderer with empty violations returns "Playable" text
```

For Lit template assertions, you can check `isCustom` and use string matching on the rendered output (convert TemplateResult to string if needed), or just verify `isCustom` is correct for each scenario.

**Note:** Lit's `html` and `unsafeHTML` work in Node (Lit has SSR support), but if there are import issues, the tests can be simplified to just verifying the renderer registration and `isCustom` flags.

### Acceptance criteria

- [ ] Three renderers registered: compile, fretboard, check_playability
- [ ] Compile renderer shows inline SVG for successful compilations
- [ ] Compile renderer shows error list for failed compilations
- [ ] Fretboard renderer shows SVG in compact card
- [ ] Playability renderer shows ✓ Playable / ⚠ issues with difficulty badge
- [ ] All renderers return `{ content, isCustom: false }` when details are missing (graceful fallback)
- [ ] Streaming state shows placeholder text

---

## Build Verification

After both beads are complete, verify the Vite build works:

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  npx vite build 2>&1
  echo "---"
  ls -la dist/
  echo "---"
  du -sh dist/
'
```

The build should produce `dist/index.html` and bundled JS/CSS. Check that the output size is reasonable (not just a 2KB CSS file — that would mean Vite didn't bundle the JS).

Also verify the dev server starts (it won't serve a full app without the Express backend, but it should start without import errors):

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  timeout 10 npx vite --host 0.0.0.0 2>&1 || true
'
```

---

## Execution Order

Bead 1 (main.ts) first — it defines the import for `registerRenderers()`. Bead 2 (renderers.ts) second — it implements the function that main.ts calls.

Or they can be done together since they reference each other.

---

## Key Gotchas

1. **Tool export names:** The bead description uses `voicingsTool` and `checkPlayabilityTool` but the actual exports in `src/tools.ts` might be named differently. Check with:

   ```bash
   grep 'export const' src/tools.ts
   ```

   Use the actual exported names.

2. **Lit imports in Node tests:** `lit` and `lit/directives/unsafe-html.js` may need special handling in Vitest. If imports fail, add them to `optimizeDeps.include` in `vite.config.ts` or configure Vitest to handle them. Alternatively, skip Lit-dependent assertions in Node tests and focus on registration/isCustom checks.

3. **`streamProxy` import:** The function is exported from `@mariozechner/pi-agent-core`. Verify:

   ```bash
   grep 'streamProxy' node_modules/@mariozechner/pi-agent-core/dist/index.d.ts
   ```

4. **CSS for renderers:** Inline styles are used in the renderer examples above. This is intentional — it avoids needing to coordinate external CSS with Lit's shadow DOM. For a polished version, styles could move to a shared stylesheet, but inline is fine for v1.

5. **`unsafeHTML`:** Required for rendering SVG strings from tool results. The SVG comes from LilyPond (trusted server output), so XSS risk is minimal. Import from `lit/directives/unsafe-html.js`.

6. **Model ID:** The default model ID in `initialState.model` should match what the server's stream route can proxy. If the LLM provider env var is `ANTHROPIC_API_KEY`, use provider `"anthropic"`. The model ID should be a valid Anthropic model (e.g., `claude-sonnet-4-20250514` or similar).

---

## Final Gate

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  npm install &&
  npm run typecheck &&
  npm test &&
  echo "--- VITE BUILD ---" &&
  npx vite build 2>&1
'
```

All tests must pass. No typecheck errors. Vite build must succeed. Commit with message:

`wave 10: browser wiring — agent, tool renderers, main.ts`

Do NOT push — leave the commit local.
