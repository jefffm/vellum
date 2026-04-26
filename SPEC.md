# Vellum — ve*LLM*um

> The writing surface where the LLM writes music.

## Overview

Vellum is an LLM-powered music arrangement tool for historical plucked string instruments, classical guitar, piano, and voice. It renders properly formatted tablature and standard notation via LilyPond.

**The key insight:** The LLM handles musical intelligence — arrangement decisions, voice leading, idiomatic writing. The code provides **native domain-specific tools** that handle mechanical correctness, shrinking the LLM's error surface to just musical judgment. This is the agent harness thesis in practice: the harness shapes what the model can do, making it more effective within a domain than a general-purpose agent with bash access.

**The product is a pi-mono web app** — a custom web application built on [pi-mono](https://github.com/badlogic/pi-mono)'s agent toolkit, deployed as a NixOS module on servoid. The browser hosts the conversational agent and a live tablature workbench. The server provides tool backends (LilyPond compilation, instrument data) and proxies LLM API calls.

---

## Problem Statement

Arranging music for historical lute-family instruments is hard:

1. **Tuning complexity** — Baroque lute has 13 courses in d-minor tuning with diapasons (bass courses that can't be stopped). Baroque guitar has 5 courses with re-entrant tuning. These aren't standard guitar tunings.
2. **Playability constraints** — Left-hand stretches, course spacing, open string availability, thumb-index alternation in the right hand. A mechanically correct transposition can be physically unplayable.
3. **Idiomatic writing** — Good lute music uses campanella (bell-like ringing across courses), brisé texture (broken chords), and specific ornament conventions that differ from guitar idiom.
4. **Notation** — Historical lute music uses tablature (French letter tab, Italian number tab), not standard notation. Modern tools handle this poorly.
5. **Instrument conversion** — Taking a guitar arrangement and putting it on lute (or vice versa) requires re-mapping every note to the new tuning, often requiring re-voicing entire passages.

---

## Architecture

### Client-Server Split

The Agent runs **in the browser**. Tools that need server resources (LilyPond, file storage) make HTTP calls to the Vellum server API. LLM API calls are proxied through the server to keep API keys secure.

```
Browser
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  src/main.ts                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Agent instance (pi-agent-core)                           │ │
│  │  • Tools array: compile, tabulate, voicings,              │ │
│  │    check_playability, transpose, diapasons, fretboard     │ │
│  │  • System prompt with instrument profiles                 │ │
│  │  • LLM calls → streamProxy → server /api/stream           │ │
│  │                                                            │ │
│  │  Each tool's execute() calls server REST API:              │ │
│  │    fetch("/api/compile", { body: lySource })               │ │
│  │    fetch("/api/instruments/baroque-lute-13")               │ │
│  │    etc.                                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  pi-web-ui                                                    │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │  ChatPanel               │  │  ArtifactsPanel            │ │
│  │  (AgentInterface)        │  │  (tablature workbench)     │ │
│  │                          │  │                            │ │
│  │  Conversation stream     │  │  • tablature.svg (compiled │ │
│  │  with inline tool        │  │    LilyPond output)        │ │
│  │  renderers:              │  │  • fretboard.svg           │ │
│  │                          │  │  • arrangement.ly (source) │ │
│  │  • compile → SVG preview │  │  • MIDI player (HTML       │ │
│  │  • fretboard → diagram   │  │    artifact, v2)           │ │
│  │  • playability → report  │  │                            │ │
│  └─────────────────────────┘  └────────────────────────────┘ │
│                                                               │
└──────────────────────┬────────────────────────────────────────┘
                       │  HTTPS (mTLS via step-ca)
                       │
servoid (NixOS)        │
┌──────────────────────┴────────────────────────────────────────┐
│  Vellum Server (Express)                                       │
│                                                                 │
│  Static Assets                                                  │
│  └─ Serves built browser bundle (Vite output)                   │
│                                                                 │
│  API Endpoints                                                  │
│  ├─ POST /api/stream          LLM proxy (streamProxy from       │
│  │                            pi-agent-core; keeps API keys      │
│  │                            server-side)                       │
│  │                                                               │
│  ├─ POST /api/compile         Accepts .ly source string.         │
│  │                            Writes temp file, runs LilyPond    │
│  │                            subprocess, returns:               │
│  │                            { svg, pdf?, midi?, errors[] }     │
│  │                                                               │
│  ├─ POST /api/validate        Syntax-only check (LilyPond       │
│  │                            --loglevel=ERROR, no output)       │
│  │                                                               │
│  ├─ GET  /api/instruments     List all instrument profiles       │
│  ├─ GET  /api/instruments/:id Single instrument profile (YAML)   │
│  │                                                               │
│  ├─ GET  /api/arrangements    List saved arrangements            │
│  ├─ POST /api/arrangements    Save arrangement (.ly + metadata)  │
│  ├─ GET  /api/arrangements/:id  Retrieve arrangement             │
│  │                                                               │
│  └─ GET  /api/templates/:name  LilyPond template source          │
│                                                                 │
│  LilyPond (Nix package, pinned 2.24.x)                          │
│  └─ Called as subprocess by /api/compile                         │
│                                                                 │
│  instruments/*.yaml + *.ily   (served via /api/instruments)      │
│  templates/*.ly               (served via /api/templates)        │
│                                                                 │
│  Traefik → vellum.aoeu.pw                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Agent in browser, not server.** Pi-web-ui's `ChatPanel` requires a local `Agent` instance via `chatPanel.setAgent(agent)`. Running the Agent server-side would require a custom WebSocket/SSE transport layer and lose most of pi-web-ui's built-in functionality. Browser-side Agent with server API calls is the natural pi-mono pattern.

**LLM proxy via streamProxy.** Pi-agent-core provides `streamProxy` for routing LLM API calls through a server endpoint. This keeps API keys (Anthropic, OpenAI, etc.) server-side while the Agent runs in the browser. The browser never sees the API key.

**Tool execution pattern.** Each tool's `execute()` method runs in the browser but makes `fetch()` calls to server endpoints for anything requiring server resources. Pure-computation tools (tabulate, voicings, check_playability) *could* run entirely in the browser — instrument profiles are loaded at init — but routing through the server keeps the browser bundle small and instrument data authoritative. For v1, all tools call the server.

**Instrument profiles: dual location.** YAML profiles are served to the browser (for system prompts and tool context). `.ily` include files stay on the server (only LilyPond needs them). Both live in `instruments/` on disk; the server API handles the split.

### Why Native Tools Beat Generic Agent + Bash

A general-purpose agent with bash access can technically run LilyPond. But:

| Generic agent | Vellum |
|---|---|
| LLM writes raw .ly hoping it compiles | LLM calls `voicings()` to get playable options, picks the best one |
| `bash lilypond foo.ly` → 200 lines of stderr | `compile()` → structured errors: "Bar 8: stretch violation on course 3" |
| LLM invents fret positions from training data | `tabulate()` returns all valid positions with idiomatic ranking |
| No verification until compile fails | `check_playability()` catches impossible fingerings before compilation |
| Human reads PDF to check quality | Browser shows live preview, fretboard diagrams, MIDI playback |

The LLM makes **musical decisions**. The tools handle **mechanical correctness**. That's the split that matters.



---

## Technology Stack

### pi-mono Integration

Vellum is built on [pi-mono](https://github.com/badlogic/pi-mono), an open-source AI agent toolkit:

| Package | Role in Vellum |
|---|---|
| `pi-agent-core` | Agent loop, tool definitions (`AgentTool<T>`), tool execution, `streamProxy` for LLM API proxying |
| `pi-web-ui` | `ChatPanel`, `AgentInterface`, `ArtifactsPanel`, `registerToolRenderer()`, `SessionsStore` (IndexedDB) |
| `pi-ai` | Multi-provider LLM API (Anthropic, OpenAI, Google, etc.) — consumed via streamProxy on the server |

Pi-mono provides the agent infrastructure. Vellum provides the domain-specific tools, instrument knowledge, and UI customizations that transform a generic agent into a music arrangement specialist.

### Browser Stack

- **pi-web-ui** — `ChatPanel` + `ArtifactsPanel` web components (the entire UI shell)
- **pi-agent-core** — `Agent` class, `AgentTool<T>` definitions (runs in browser)
- **Vite** — build tool, bundles the browser application
- **Custom tool renderers** — `registerToolRenderer()` for inline SVG preview, fretboard diagrams, playability reports in the chat stream

### Server Stack

- **Node.js** ≥ 20 + **Express** — API server, static asset serving, LLM proxy
- **LilyPond** ≥ 2.24 — music engraving subprocess, pinned as a Nix dependency
- **NixOS** — deployment target (servoid)
- **Traefik** — reverse proxy with mTLS via step-ca
- **systemd** — process management

---

## Custom Tools

Tools are defined as `AgentTool<T>` objects using TypeBox schemas and passed to the `Agent` constructor. The LLM calls them as native tool calls. Each tool's `execute()` method makes an HTTP request to the Vellum server API for anything requiring server resources.

### Tool Definition Pattern

All Vellum tools follow this pattern:

```typescript
import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

// TypeBox schema for parameters
const CompileParams = Type.Object({
  source: Type.String({ description: "LilyPond source code to compile" }),
  format: Type.Optional(Type.Union([
    Type.Literal("svg"),
    Type.Literal("pdf"),
    Type.Literal("both")
  ], { default: "svg" }))
});

// Tool result details type (for UI rendering via registerToolRenderer)
interface CompileDetails {
  svg?: string;
  pdf?: string;     // base64-encoded
  midi?: string;    // base64-encoded
  errors: CompileError[];
}

// AgentTool definition
const compileTool: AgentTool<typeof CompileParams, CompileDetails> = {
  name: "compile",
  description: "Compile LilyPond source into rendered tablature/notation. " +
    "Returns SVG for preview and structured errors if compilation fails. " +
    "Call this after generating or modifying LilyPond source.",
  parameters: CompileParams,

  async execute(
    toolCallId: string,
    params: Static<typeof CompileParams>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<CompileDetails>
  ): Promise<AgentToolResult<CompileDetails>> {
    // Call server API
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,  // respect cancellation
    });
    const data = await res.json();

    if (data.errors?.length > 0) {
      return {
        content: [{
          type: "text",
          text: `Compilation failed with ${data.errors.length} error(s):\n` +
            data.errors.map((e: CompileError) =>
              `  Bar ${e.bar}, beat ${e.beat}: ${e.message}`
            ).join("\n")
        }],
        details: { errors: data.errors, svg: undefined, pdf: undefined, midi: undefined },
      };
    }

    return {
      content: [{
        type: "text",
        text: `Compiled successfully. SVG rendered (${data.barCount} bars, ${data.voiceCount} voices). No errors.`
      }],
      details: {
        svg: data.svg,
        pdf: data.pdf,
        midi: data.midi,
        errors: [],
      },
    };
  }
};
```

**Key points:**
- `content` is what the LLM sees — concise text summaries, never raw SVG/binary data
- `details` carries structured data for the custom tool renderer — SVGs, diagrams, full error objects
- `signal` enables aborting long LilyPond compilations
- `onUpdate` can stream partial results (e.g., compilation progress)

### Tool Renderers

Custom tool renderers display visual results inline in the chat stream:

```typescript
import { registerToolRenderer } from "@mariozechner/pi-web-ui";

registerToolRenderer("compile", {
  render(params, result) {
    if (result.details?.svg) {
      const container = document.createElement("div");
      container.className = "compile-result";
      container.innerHTML = result.details.svg;
      return container;
    }
    return null; // fall back to default text rendering
  }
});

registerToolRenderer("fretboard", {
  render(params, result) {
    if (result.details?.svg) {
      const container = document.createElement("div");
      container.className = "fretboard-diagram";
      container.innerHTML = result.details.svg;
      return container;
    }
    return null;
  }
});
```

### compile

Runs LilyPond as subprocess on the server. On success, returns rendered artifacts. On failure, parses stderr into structured errors with bar numbers and line references.

**Parameters:**
```typescript
{
  source: string,          // LilyPond source code
  format?: "svg" | "pdf" | "both"  // output format (default: "svg")
}
```

**Returns to LLM (`content`):** Text summary — "Compiled successfully. 42 bars, 3 voices." or structured error list.

**Returns to UI (`details`):**
```typescript
{
  svg?: string,            // rendered tablature SVG
  pdf?: string,            // base64-encoded PDF
  midi?: string,           // base64-encoded MIDI
  errors: CompileError[]   // structured: { bar, beat, line, type, message }
}
```

**Server endpoint:** `POST /api/compile` — writes temp `.ly` file, invokes `lilypond` subprocess, parses output. LilyPond stderr is parsed into structured `CompileError` objects (bar number, beat, error type, human-readable message) rather than passing raw Guile stack traces to the LLM.

### tabulate

Returns all valid course/fret positions for a pitch on the target instrument, ranked by idiomatic quality.

**Parameters:**
```typescript
{
  pitch: string,           // e.g. "F4", "A3"
  instrument: string       // instrument profile ID
}
```

**Returns to LLM:** Text listing of positions with quality ratings.

**Returns to UI:** `{ positions: TabPosition[] }` — for potential fretboard highlighting.

```typescript
// TabPosition
{ course: number, fret: number, quality: "open" | "low_fret" | "high_fret" | "diapason" }
// e.g. tabulate("F4", "baroque-lute-13")
// → [{ course: 1, fret: 0, quality: "open" },
//    { course: 2, fret: 3, quality: "low_fret" }]
```

Ranking: open string > low fret (1-3) > high fret (4-8). Diapason courses return only if the pitch exactly matches the open tuning. The LLM uses this to make informed placement decisions instead of guessing from training data.

### voicings

Enumerates all playable voicings for a chord, ranked by stretch, idiomatic quality, and campanella potential.

**Parameters:**
```typescript
{
  notes: string[],         // e.g. ["F4", "A3", "D3"]
  instrument: string,
  max_stretch?: number     // max fret span (default: 4 for lute, 5 for guitar)
}
```

**Returns to LLM:** Top 5 voicings with stretch and quality scores.

**Returns to UI:** `{ voicings: Voicing[] }` — full list with positions for fretboard rendering.

```typescript
// Voicing
{ positions: TabPosition[], stretch: number, campanella_score: number, open_strings: number }
```

### check_playability

Validates a passage against instrument-specific constraints: fret stretch, same-course conflicts, right-hand pattern feasibility.

**Parameters:**
```typescript
{
  bars: Bar[],             // structured passage (notes with positions)
  instrument: string
}
```

**Returns to LLM:** Violation list and difficulty rating.

**Returns to UI:** `{ violations: Violation[], difficulty: string, flagged_bars: number[] }`.

```typescript
// Violation
{ bar: number, type: "stretch" | "same_course" | "rh_pattern" | "out_of_range", description: string }
```

**Difficulty algorithm (v1 minimum viable):**
- Count violations (any → at least "intermediate")
- Max fret stretch per chord (>4 lute / >5 guitar = "advanced")
- Position shifts per bar (>2 = adds difficulty)
- Simultaneous voice count (>3 sustained = "advanced" on lute)
- Simple weighted sum → beginner / intermediate / advanced

### transpose

Transposes and validates against instrument range. Suggests idiomatic keys for the target instrument.

**Parameters:**
```typescript
{
  source: string,          // .ly passage or structured notes
  interval: string,        // e.g. "m3 up", "P5 down"
  instrument: string
}
```

**Returns to LLM:** Transposed result with out-of-range warnings and key suggestions.

**Returns to UI:** `{ result: string, out_of_range: Note[], suggested_key?: string }`.

**Idiomatic keys by instrument:**

| Instrument | Good keys | Why |
|---|---|---|
| Baroque lute (d-minor) | D minor, A minor, F major, G minor, C major | Open strings align with key center |
| Baroque guitar | A minor, E minor, C major, G major, D minor | Standard guitar-adjacent keys |
| Renaissance lute (G) | G major, D minor, C major, A minor | Open-string keys |
| Theorbo | D minor, G minor, A minor | Continuo keys, diapason alignment |
| Classical guitar | E minor, A minor, D major, G major, C major | Standard repertoire keys |

### diapasons

Returns the conventional diapason tuning for a key center. Lutenists retune bass courses per piece — this tool provides the historically informed default.

**Parameters:**
```typescript
{
  key: string,             // e.g. "D minor", "A minor", "G minor"
  instrument?: string      // default: "baroque-lute-13"
}
```

**Returns to LLM:** Human-readable tuning description.

**Returns to UI:** `{ courses: DiapasonCourse[] }`.

**Standard diapason tuning schemes (baroque lute, courses 7→13):**

| Key Center | 7 | 8 | 9 | 10 | 11 | 12 | 13 | Name |
|---|---|---|---|---|---|---|---|---|
| D minor / F major | G | F | E♭ | D | C | B♭ | A | *Accord ordinaire* (standard) |
| A minor / C major | G | F | E♮ | D | C | B♮ | A | Natural 3rd and 7th |
| G minor / B♭ major | G | F | E♭ | D | C | B♭ | A | Same as standard (coincidence) |
| D major (rare) | G | F♯ | E♮ | D | C♯ | B♮ | A | Sharp keys (Weiss) |
| E minor | G | F♯ | E♮ | D | C♮ | B♮ | A | Natural with F♯ |

The tool also supports per-piece override for non-standard tunings found in some Weiss and Mouton manuscripts.

**LilyPond integration:** The tool output maps directly to `additionalBassStrings` in the `.ily` include:
```lilypond
additionalBassStrings = \stringTuning <g, f, ees, d, c, bes,, a,,>  % D minor standard
```

### fretboard

Renders a visual SVG fretboard diagram showing finger positions.

**Parameters:**
```typescript
{
  positions: TabPosition[],
  instrument: string
}
```

**Returns to LLM:** Text description of the diagram ("Fretboard showing D minor chord: course 1 open, course 3 fret 2...").

**Returns to UI:** `{ svg: string }` — rendered SVG diagram, displayed inline via tool renderer and optionally in ArtifactsPanel.



---

## Agent Setup

### Browser Entry Point

The main browser entry point creates the Agent, registers tool renderers, and wires up the ChatPanel:

```typescript
// src/main.ts
import { Agent } from "@mariozechner/pi-agent-core";
import { ChatPanel, ArtifactsPanel, registerToolRenderer } from "@mariozechner/pi-web-ui";
import { compileTool, tabulateTool, voicingsTool, checkPlayabilityTool,
         transposeTool, diapasonsTool, fretboardTool } from "./tools";
import { compileRenderer, fretboardRenderer, playabilityRenderer } from "./renderers";

// Register custom tool renderers (inline visual feedback in chat)
registerToolRenderer("compile", compileRenderer);
registerToolRenderer("fretboard", fretboardRenderer);
registerToolRenderer("check_playability", playabilityRenderer);

// Load instrument profiles for system prompt
const instruments = await fetch("/api/instruments").then(r => r.json());

// Create Agent with all tools
const agent = new Agent({
  initialState: {
    tools: [
      compileTool, tabulateTool, voicingsTool, checkPlayabilityTool,
      transposeTool, diapasonsTool, fretboardTool,
    ],
    systemPrompt: buildSystemPrompt(instruments),
  },
  // LLM calls proxied through server (API keys stay server-side)
  streamProxy: "/api/stream",
});

// Wire up the UI
const chatPanel = document.querySelector("chat-panel") as ChatPanel;
chatPanel.setAgent(agent);
```

### System Prompt Design

The system prompt establishes the LLM's role and injects instrument knowledge:

```markdown
You are Vellum, a music arrangement specialist for historical plucked string
instruments, classical guitar, piano, and voice. You have expert knowledge of
baroque lute, baroque guitar, Renaissance lute, theorbo, and classical guitar
idioms.

## Your Tools
You have access to domain-specific tools for mechanical correctness. Use them:
- Call `tabulate` to find valid positions — never guess fret/course placements
- Call `voicings` to enumerate chord options — pick from real alternatives
- Call `check_playability` to validate before presenting to the user
- Call `compile` after generating or modifying LilyPond source
- Call `diapasons` when working in a new key on baroque lute or theorbo

## Workflow
1. When given a source file (.ly, MusicXML), read it first
2. When arranging from memory, warn the user: "I'm working from memory —
   please verify the pitches against a reference score"
3. Use tools for all mechanical decisions (positions, voicings, playability)
4. Always compile and verify before presenting the final result
5. After a successful compile, use the artifacts tool to update the tablature
   preview in the side panel

## Instruments
[Instrument profiles injected here — tunings, constraints, notation type]
```

**Source-file-first workflow:** The system prompt explicitly instructs the LLM to prefer source files over memory recall. LLMs cannot reliably recall specific pitches (see OQ-02 research). When no source is provided, the LLM must disclose this and recommend verification. This is a v1 design constraint, not a limitation to fix later.

### Auto-Compile Behavior

There is no file-system hook for auto-compilation. The Agent runs in the browser — there is no file system to watch. Instead, auto-compile is handled by **prompt instruction**: the system prompt tells the LLM to call the `compile` tool after generating or modifying LilyPond source. This is simpler and more reliable than event-based triggering.

After a successful compile, the LLM is instructed to call the built-in `artifacts` tool to create or update `tablature.svg` in the ArtifactsPanel. This gives the user a persistent side-panel preview that updates as the arrangement evolves.

### Profile Injection

Instrument profiles are loaded from the server at initialization and included in the system prompt. When the user mentions a specific instrument mid-conversation, the LLM already has the profile in context — no runtime hook needed.

For conversations that switch instruments, the full profile set is included in the system prompt (they're small — ~50 lines each in YAML). If context limits become an issue with very long arrangements, profiles can be lazy-loaded via a `get_instrument` tool call, but this is unlikely to be needed in v1.

---

## Instrument Profiles

Each supported instrument is defined as a YAML profile (for tool logic and system prompts) and a LilyPond include file (.ily, for engraving). Profiles are served to the browser via `GET /api/instruments/:id` and loaded into the system prompt at session start.

### Baroque Lute (13-course, d-minor)

```yaml
id: baroque-lute-13
name: "13-Course Baroque Lute (d-minor)"
courses: 13
fretted_courses: 6        # courses 1-6 have frets
open_courses: 7           # courses 7-13 are diapasons (unfretted bass)
tuning:                    # highest to lowest
  - { course: 1, pitch: "f'",  note: "F4" }    # chanterelle
  - { course: 2, pitch: "d'",  note: "D4" }
  - { course: 3, pitch: "a",   note: "A3" }
  - { course: 4, pitch: "f",   note: "F3" }
  - { course: 5, pitch: "d",   note: "D3" }
  - { course: 6, pitch: "a,",  note: "A2" }
  # Diapasons (open bass strings, tuned diatonically — varies by key)
  - { course: 7,  pitch: "g,",  note: "G2" }
  - { course: 8,  pitch: "f,",  note: "F2" }
  - { course: 9,  pitch: "e,",  note: "E2" }
  - { course: 10, pitch: "d,",  note: "D2" }
  - { course: 11, pitch: "c,",  note: "C2" }
  - { course: 12, pitch: "b,,", note: "B1" }   # sometimes Bb
  - { course: 13, pitch: "a,,", note: "A1" }
frets: 8                   # typically 8 frets on the neck
diapason_schemes:          # standard tunings by key (courses 7-13)
  d_minor: ["G", "F", "Eb", "D", "C", "Bb", "A"]     # accord ordinaire
  a_minor: ["G", "F", "E",  "D", "C", "B",  "A"]     # natural 3rd/7th
  g_minor: ["G", "F", "Eb", "D", "C", "Bb", "A"]     # same as standard
  d_major: ["G", "F#", "E", "D", "C#", "B",  "A"]    # sharp keys
  e_minor: ["G", "F#", "E", "D", "C",  "B",  "A"]    # natural with F#
constraints:
  - "Diapasons (courses 7-13) cannot be fretted — open only"
  - "Maximum left-hand stretch: ~4 frets on upper courses"
  - "Thumb plays courses 4-13; index-middle alternate on 1-3"
  - "Campanella encouraged — let notes ring across courses"
  - "Brisé (broken chord) texture is idiomatic, especially in French style"
  - "Right-hand thumb-under technique for bass runs"
notation: "french-letter"  # a=0, b=1, c=2, d=3, e=4, f=5, g=6, h=7
```

### Baroque Guitar (5-course, re-entrant)

```yaml
id: baroque-guitar-5
name: "5-Course Baroque Guitar"
courses: 5
fretted_courses: 5
open_courses: 0
tuning:                    # nominal pitches (actual sounding depends on stringing)
  - { course: 1, pitch: "e'",  note: "E4" }
  - { course: 2, pitch: "b",   note: "B3" }
  - { course: 3, pitch: "g",   note: "G3" }
  - { course: 4, pitch: "d'",  note: "D4", re_entrant: true }
  - { course: 5, pitch: "a",   note: "A3", re_entrant: true }
frets: 8
stringing: "french"        # default; options: "french", "italian", "mixed"
# Stringing variants (per OQ-04 / OQ-18 research):
#
# | Variant  | Course 5       | Course 4       | Origin              |
# |----------|--------------- |----------------|---------------------|
# | french   | a/a (unison)   | d/d' (octave)  | de Visée, Campion   |
# | italian  | A/a (bourdon)  | d/d' (octave)  | Foscarini, Corbetta |
# | mixed    | a/a (unison)   | d/d' (octave)  | Modern compromise   |
#
# French: fully re-entrant, maximum campanella, no bass below G3
# Italian: bourdons on 4+5, bass foundation, continuo-ready
# Mixed: bourdon on 4 only, partial bass
#
# The stringing parameter affects tabulate() and voicings() ranking:
# - French stringing favors campanella scoring
# - Italian stringing favors bass-line completeness
constraints:
  - "Re-entrant tuning: courses 4-5 sound higher than expected (depends on stringing)"
  - "Strummed (rasgueado) and plucked (punteado) styles"
  - "Alfabeto chord notation for strummed passages"
  - "Campanella especially effective due to re-entrant tuning"
  - "French stringing: no true bass below G3 (course 3 open)"
  - "Italian stringing: bass available on courses 4-5 via bourdons"
notation: "french-letter"  # or italian-number depending on source tradition
```

### Renaissance Lute (6-course, G)

```yaml
id: renaissance-lute-6
name: "6-Course Renaissance Lute (G tuning)"
courses: 6
fretted_courses: 6
open_courses: 0
tuning:
  - { course: 1, pitch: "g'",  note: "G4" }
  - { course: 2, pitch: "d'",  note: "D4" }
  - { course: 3, pitch: "a",   note: "A3" }
  - { course: 4, pitch: "f",   note: "F3" }
  - { course: 5, pitch: "c",   note: "C3" }
  - { course: 6, pitch: "g,",  note: "G2" }
frets: 8
constraints:
  - "All courses fretted"
  - "Thumb-index alternation standard"
  - "Simpler voice leading than baroque lute"
  - "Intabulation of vocal polyphony is core repertoire"
notation: "italian-number"  # or french-letter
```

### Theorbo (14-course)

```yaml
id: theorbo-14
name: "14-Course Theorbo"
courses: 14
fretted_courses: 6
open_courses: 8
tuning:
  # Fretted courses (1st and 2nd are an octave lower than on a standard lute)
  - { course: 1, pitch: "a",   note: "A3" }    # octave down from lute
  - { course: 2, pitch: "e",   note: "E3" }    # octave down from lute
  - { course: 3, pitch: "b",   note: "B3" }
  - { course: 4, pitch: "g",   note: "G3" }
  - { course: 5, pitch: "d",   note: "D3" }
  - { course: 6, pitch: "a,",  note: "A2" }
  # Diapasons
  - { course: 7,  pitch: "g,",  note: "G2" }
  - { course: 8,  pitch: "f,",  note: "F2" }
  - { course: 9,  pitch: "e,",  note: "E2" }
  - { course: 10, pitch: "d,",  note: "D2" }
  - { course: 11, pitch: "c,",  note: "C2" }
  - { course: 12, pitch: "b,,", note: "B1" }
  - { course: 13, pitch: "a,,", note: "A1" }
  - { course: 14, pitch: "g,,", note: "G1" }
frets: 8
constraints:
  - "Courses 1-2 tuned an octave lower than standard lute — melody often on 3rd course"
  - "Diapasons (7-14) unfretted"
  - "Very long scale length on diapasons — big instrument"
  - "Continuo instrument: often reading from figured bass"
notation: "french-letter"
```

### Classical Guitar (6-string)

```yaml
id: classical-guitar-6
name: "Classical Guitar"
type: fretted
strings: 6
fretted_strings: 6
open_strings: 0
tuning:
  - { string: 1, pitch: "e'",  note: "E4" }
  - { string: 2, pitch: "b",   note: "B3" }
  - { string: 3, pitch: "g",   note: "G3" }
  - { string: 4, pitch: "d",   note: "D3" }
  - { string: 5, pitch: "a,",  note: "A2" }
  - { string: 6, pitch: "e,",  note: "E2" }
frets: 19
constraints:
  - "Standard concert tuning"
  - "Maximum left-hand stretch: ~5 frets in lower positions, ~4 above 7th"
  - "Thumb plays strings 4-6; i-m-a on 1-3 (p-i-m-a notation)"
  - "Barre chords available — full or partial"
  - "Harmonics at frets 5, 7, 12"
  - "Can handle up to 4 independent voices simultaneously"
notation: "number-tab"  # standard guitar tablature (or standard notation)
```

### Piano

```yaml
id: piano
name: "Piano"
type: keyboard
range:
  lowest: "a,,,"   # A0
  highest: "c''''''" # C8
staves: 2           # treble + bass (grand staff)
constraints:
  - "Maximum stretch: ~10th (large hands) or octave (average)"
  - "Each hand can play up to 5 simultaneous notes"
  - "Sustain pedal extends note duration beyond finger release"
  - "Wide dynamic range — can mark pp to ff"
  - "No pitch bending, vibrato, or microtones"
  - "Hands are semi-independent — voice crossing between staves is idiomatic"
notation: "standard"  # grand staff, treble + bass clef
```

### Voice (SATB)

```yaml
id: voice-soprano
name: "Soprano Voice"
type: voice
range: { lowest: "c'", highest: "a''" }    # C4–A5
clef: treble
constraints:
  - "Monophonic — one note at a time"
  - "Must breathe — phrase lengths limited by breath capacity"
  - "Tessitura matters more than absolute range — avoid sitting at extremes"
  - "Text underlay: syllables aligned to notes"
  - "Melismatic or syllabic setting"
  - "Passaggio (register break) around E5-F5"
---
id: voice-alto
name: "Alto Voice"
range: { lowest: "f", highest: "d''" }     # F3–D5
clef: treble
---
id: voice-tenor
name: "Tenor Voice"
range: { lowest: "c", highest: "a'" }      # C3–A4
clef: "treble_8"
---
id: voice-bass
name: "Bass Voice"
range: { lowest: "e,", highest: "e'" }     # E2–E4
clef: bass
```

Voice profiles enable:
- **Song arrangements** — melody line with lute/guitar accompaniment
- **Continuo realization** — soprano line + figured bass → full texture
- **Transcription** — vocal part extracted from a choral work for study
- **Intabulation** — arranging vocal polyphony for solo lute (core Renaissance repertoire)

Additional profiles can be added: archlute, mandora, vihuela, 7-course Dowland-era lute, etc.



---

## Arrangement Engine — How the LLM Thinks

### Input Types

The LLM accepts multiple input formats. **Source files are the preferred v1 workflow** — the LLM should not be trusted to recall specific pitches from memory (see research in OPEN-QUESTIONS.md OQ-02).

1. **LilyPond source** — read directly, modify. **Primary v1 input.**
2. **Lead sheet** — melody + chord symbols → LLM creates full arrangement. **Primary v1 input.**
3. **Guitar tablature** — parsed, notes extracted, remapped via `tabulate()` tool
4. **Natural language** — "Arrange Greensleeves for baroque lute" → LLM uses its training data. **Best-effort only — LLM must disclose it is working from memory and recommend pitch verification.**
5. **Figured bass** — bass line + figures → LLM realizes the harmony (historically authentic workflow)
6. **MusicXML file** — parsed into pitches, durations, voices (v2, via import tool)

### Arrangement Process

The LLM follows this process, using native tools for mechanical steps:

```
1. SOURCE VERIFICATION
   - If source file provided: read and parse
   - If from memory: warn user, recommend verification against reference score
   - Call diapasons(key) for lute/theorbo to set bass string tuning

2. PITCH MAPPING (via tabulate tool)
   - For each note, call tabulate(pitch, instrument) to get valid positions
   - Score each option: open string preferred > low fret > high fret
   - Diapasons: exact pitch must match current tuning scheme

3. VOICE LEADING (LLM musical judgment)
   - Minimize left-hand movement between chords
   - Prefer common tones held across beats
   - Respect voice independence (bass, tenor, soprano lines)
   - Drop notes that create impossible stretches — prefer musical coherence

4. PLAYABILITY CHECK (via check_playability tool)
   - Call check_playability(bars, instrument) to validate
   - Fix any violations before proceeding
   - Use voicings(chord, instrument) to find alternatives

5. IDIOM LAYER (LLM musical judgment)
   - Brisé: break chords into arpeggiated figures where appropriate
   - Campanella: route scalar passages across courses for ringing effect
   - Ornamentation: add period-appropriate ornaments (see Ornaments section)
   - Style brisé specifically for French baroque lute

6. OUTPUT GENERATION
   - Generate LilyPond tablature notation using appropriate template
   - Call compile() to render — system prompt instructs this explicitly
   - If compilation errors, parse structured feedback, fix, recompile
   - On success, call artifacts tool to update tablature.svg in side panel
   - Iterate until clean
```

### Instrument Conversion

Converting between instruments (e.g., guitar → lute):

1. **Extract pitches** from source (tab position → absolute pitch via `tabulate()`)
2. **Re-map** each pitch to the target instrument using `tabulate(pitch, new_instrument)`
3. **Re-voice** passages using `voicings()` where original voicing doesn't fit
4. **Validate** via `check_playability()` on the new arrangement
5. **Adapt idiom** — LLM adjusts style (guitar arpeggios → brisé, strummed chords → thinning)

---

## LilyPond Integration

### Why LilyPond

- **Text-based input** — LLM generates it natively, no binary format issues
- **Tablature support** — `\new TabStaff` with custom tunings, including French letter tab
- **Publication quality** — best open-source music engraving available
- **Programmable** — Scheme extensions for custom behavior
- **Free** — no licensing issues

### Server-Side Only

LilyPond is a C++ program depending on Guile (Scheme), Pango, Fontconfig, and GhostScript. It cannot run in the browser. All compilation happens server-side via `POST /api/compile`. The browser receives rendered SVG/PDF artifacts.

### French Letter Tablature

French letter tab is the native notation for baroque lute. LilyPond 2.24 has full support:

```lilypond
\version "2.24.0"

% Rhythm flags (above the tab)
rhythm = \relative {
  \autoBeamOff
  d'4 a f d8 a |
  % ...
}

% Music (the actual notes — shared between tab and hidden MIDI staff)
music = \relative {
  \voiceOne
  d'4 a f d8 a |
  % ...
}

\score {
  <<
    % Rhythm staff: flags only, no staff lines
    \new RhythmicStaff \with {
      \override StaffSymbol.line-count = 0
      \autoBeamOff
      \remove Bar_engraver
      \override VerticalAxisGroup.staff-staff-spacing.basic-distance = 6
    } \rhythm

    % Tab staff: French letter notation with diapasons
    \new TabStaff \with {
      tablatureFormat = #fret-letter-tablature-format
      stringTunings = \stringTuning <f' d' a f d a,>       % fretted courses 1-6
      additionalBassStrings = \stringTuning <g, f, ees, d, c, bes,, a,,>  % diapasons 7-13
    } \music

    % Hidden staff for correct MIDI output
    \new Staff \with {
      \remove "Staff_symbol_engraver"
      \override NoteHead.no-ledgers = ##t
      \override NoteHead.transparent = ##t
      \override Rest.transparent = ##t
      \override Dots.transparent = ##t
      \override Stem.transparent = ##t
    } \music
  >>

  \layout { }
  \midi { \tempo 4 = 72 }
}
```

**Key LilyPond features for lute tablature:**

| Feature | Syntax | Purpose |
|---|---|---|
| French letters | `tablatureFormat = #fret-letter-tablature-format` | a=open, b=1st fret, c=2nd, etc. |
| Diapasons | `additionalBassStrings = \stringTuning <...>` | Bass courses below staff, printed as a, /a, //a |
| Custom fret labels | `fretLabels = #'("a" "b" "c" ...)` | Override default letter mapping if needed |
| Rhythm flags | `\new RhythmicStaff` above `TabStaff` | Separate rhythm notation above tab |
| Hidden MIDI staff | `\new Staff \with { ... transparent ... }` | Correct MIDI output (see below) |

### MIDI Output

LilyPond's MIDI from `TabStaff` with custom tunings works for basic cases but has edge cases with `additionalBassStrings`. The reliable pattern is a **hidden parallel Staff** that shares the same music expression:

- The hidden `Staff` produces correct MIDI with proper pitch mapping
- The visible `TabStaff` handles notation display only (`midiInstrument = ##f` if needed)
- Both reference the same `\music` variable — no duplication

This pattern is built into all LilyPond templates.

**MIDI instrument mapping:** General MIDI has no "baroque lute." Closest: `"acoustic guitar (nylon)"` (program 25). For theorbo continuo, `"acoustic bass"` (program 33) may be more appropriate for the diapason register.

### Ornaments in Tablature

The six standard baroque lute ornaments for v1, using LilyPond builtins:

| Ornament | French Name | LilyPond | Tab Display | Usage |
|---|---|---|---|---|
| Trill | tremblement | `\trill` | Symbol above letter | Very common, most accented notes |
| Mordent | martellement | `\mordent` | Symbol above letter | Alternation with note below |
| Appoggiatura | port de voix | `\appoggiatura` | Small grace note | Ascending approach note |
| Slur | tirade/coulé | `( )` | Arc between letters | Hammer-on / pull-off |
| Staccato | étouffé | `\staccato` | Dot | Muted/stopped note |
| Turn | double cadence | `\turn` | Symbol above letter | Upper-lower neighbor figure |

Ornament symbols render above the TabStaff by default. With the RhythmicStaff layout, they appear in the rhythm line area. A full configurable ornament table per style period (Gaultier vs. Mouton vs. Weiss) is a v2 refinement.

### Output Formats

LilyPond produces:
- **SVG** — primary output for browser display (inline in chat via tool renderer, persistent in ArtifactsPanel)
- **PDF** — for download/print
- **MIDI** — for playback (via hidden Staff pattern)
- **PNG** — for static display (fallback)

---

## Workflow Examples

### Example 1: Arrange from Source File

```
User: [uploads greensleeves.ly]
      "Arrange this for baroque lute. Simple version,
       mostly single line with bass notes."

Agent:
1. Reads uploaded .ly source — extracts melody and harmony
2. Loads baroque-lute-13 profile (already in system prompt)
3. Calls diapasons("A minor") → gets diapason tuning
4. Calls tabulate() for each melody note → gets course/fret positions
5. Writes .ly source using french-tab.ly template
6. Calls compile() → SVG rendered, shown inline via tool renderer
7. Calls check_playability() → no violations
8. Calls artifacts tool to update tablature.svg in side panel
9. Returns arrangement with explanation of voicing choices
```

### Example 2: Arrange from Memory (Best-Effort)

```
User: "Arrange Greensleeves for baroque lute."

Agent:
1. No source file detected — warns user:
   "I'm working from memory. Greensleeves is well-known, but I recommend
    verifying the pitches against a reference score (e.g., from IMSLP or
    the Mutopia Project)."
2. Proceeds with best-effort arrangement using training data
3. Calls diapasons("A minor") → gets diapason tuning
4. Calls tabulate() for each note → validates against instrument
5. Writes .ly → compile() → preview
6. Flags any passages where it's uncertain about the source pitches
```

### Example 3: Convert Guitar to Lute

```
User: [uploads guitar-arrangement.ly]
      "Convert this guitar arrangement to baroque lute."

Agent:
1. Reads .ly source → extracts pitches + durations
2. For each note: tabulate(pitch, "baroque-lute-13") → lute positions
3. Calls voicings() for chords that need revoicing
4. Calls check_playability() → flags 3 bars with stretch violations
5. Revoices flagged bars using voicings(chord, max_stretch=3)
6. Writes .ly → compile() → SVG preview inline
7. Updates tablature.svg in side panel via artifacts tool
8. Adjusts idiom (guitar hammer-ons → lute mordents, arpeggios → brisé)
```

### Example 4: Iterative Editing

```
User: "The stretch in bar 8 is too wide. Can you revoice that chord?"

Agent:
1. Identifies bar 8 in current arrangement
2. Extracts chord pitches → calls voicings(pitches, instrument, max_stretch=3)
3. Gets 4 alternatives ranked by quality
4. Picks the best, explains the trade-off ("dropped the tenor D3")
5. Edits .ly source → compile() → preview updates inline
6. Updates tablature.svg in side panel
```

### Example 5: Instrument Swap

```
User: "Now give me this same piece for baroque guitar."

Agent:
1. Loads baroque-guitar-5 profile (already in system prompt)
2. Asks: "Which stringing? French (no bourdons, full campanella),
   Italian (with bourdons, bass available), or mixed?"
3. User picks French
4. For each note: tabulate(pitch, "baroque-guitar-5")
5. Drops bass lines that don't fit (5 courses, no bass below G3 with French stringing)
6. check_playability() → clean
7. May suggest rasgueado for chordal passages
8. New .ly → compile() → new preview
```

### Example 6: Hymnal Conversion (SATB → Baroque Guitar)

```
User: "I have 'All Creatures of Our God and King' from my hymnal in D major,
       SATB + organ. Arrange it for baroque guitar."

Agent:
1. Reads the uploaded source (MusicXML or .ly)
2. Analyzes: 4-voice SATB, D major, melody in soprano, Alleluia refrains
3. "D major isn't ideal for baroque guitar — I'll transpose to A minor.
    That puts the melody on courses 1-2 with open strings available.
    Which stringing? French (full re-entrant), Italian, or mixed?"
4. User picks French
5. Extracts melody (soprano) + chord analysis from inner voices
6. For verses: punteado arrangement
   - Melody on courses 1-3 via tabulate()
   - Bass line simplified for courses 4-5 (re-entrant — octave higher)
   - check_playability() → clean
7. For Alleluia refrains: rasgueado arrangement
   - voicings(chord, "baroque-guitar-5", stringing="french")
   - Strummed chords with rhythm notation
8. Adds period-appropriate ornaments (mordents on cadences)
9. compile() → French tab preview (punteado sections)
   + alfabeto notation for rasgueado sections
10. "Bars 5-8 have a wide tenor-bass gap — I dropped the alto D
     and doubled the root in the strummed chord instead."
```

---

## Quality Criteria

An arrangement is "good" if:

1. **Playable** — no impossible stretches, fingerings are natural (`check_playability` passes)
2. **Musical** — voice leading is smooth, bass line makes harmonic sense
3. **Idiomatic** — sounds like it belongs on the instrument, not like a mechanical transposition
4. **Complete** — no missing notes that the instrument could have handled
5. **Readable** — tablature is clear, rhythmic notation is correct, page layout is clean

The LLM should flag when it makes compromises (dropped notes, simplified voicing) and explain why.



---

## File Structure

```
vellum/
├── flake.nix                  # Nix flake: package + NixOS module export
├── SPEC.md                    # This file
├── OPEN-QUESTIONS.md          # Gap tracker
├── README.md
├── package.json               # Node.js project root
├── tsconfig.json
├── vite.config.ts             # Vite config for browser bundle
│
├── src/
│   ├── main.ts                # Browser entry: Agent setup, ChatPanel wiring,
│   │                          #   tool renderer registration
│   ├── tools.ts               # All AgentTool<T> definitions (compile, tabulate,
│   │                          #   voicings, check_playability, transpose,
│   │                          #   diapasons, fretboard)
│   ├── renderers.ts           # registerToolRenderer() implementations for
│   │                          #   compile (SVG), fretboard (SVG), playability
│   ├── prompts.ts             # System prompt builder — instrument profile
│   │                          #   injection, workflow instructions
│   ├── types.ts               # Shared TypeBox schemas, TypeScript interfaces
│   │                          #   (TabPosition, Voicing, CompileError, etc.)
│   │
│   └── server/
│       ├── index.ts           # Express server: static assets, API routes,
│       │                      #   streamProxy endpoint
│       ├── compile.ts         # POST /api/compile — LilyPond subprocess,
│       │                      #   stderr parsing into structured errors
│       ├── instruments.ts     # GET /api/instruments — serves YAML profiles
│       ├── arrangements.ts    # GET/POST /api/arrangements — persistence
│       └── templates.ts       # GET /api/templates — LilyPond template source
│
├── instruments/               # Instrument profile definitions
│   ├── baroque-lute-13.yaml
│   ├── baroque-lute-13.ily
│   ├── baroque-guitar-5.yaml
│   ├── baroque-guitar-5.ily
│   ├── classical-guitar-6.yaml
│   ├── classical-guitar-6.ily
│   ├── renaissance-lute-6.yaml
│   ├── renaissance-lute-6.ily
│   ├── theorbo-14.yaml
│   ├── theorbo-14.ily
│   ├── piano.yaml
│   ├── piano.ily
│   ├── voice-soprano.yaml
│   ├── voice-alto.yaml
│   ├── voice-tenor.yaml
│   ├── voice-bass.yaml
│   └── voice.ily
│
├── templates/                 # LilyPond boilerplate templates
│   ├── solo-tab.ly            # Tab only (guitar number tab)
│   ├── tab-and-staff.ly       # Tab + standard notation side by side
│   ├── french-tab.ly          # French letter tab: RhythmicStaff + TabStaff
│   │                          #   + hidden Staff for MIDI
│   ├── grand-staff.ly         # Piano (treble + bass)
│   ├── voice-and-tab.ly       # Voice line + lute/guitar tab
│   ├── voice-and-piano.ly     # Voice line + piano accompaniment
│   ├── satb.ly                # Four-part choral
│   └── continuo.ly            # Figured bass realization
│
├── arrangements/              # Saved arrangements (server-side)
│   └── .../
├── sources/                   # Input files (reference scores, lead sheets)
│   └── .../
│
└── public/                    # Static assets served by Express
    └── index.html             # Shell HTML that loads the Vite-built bundle
```

**What changed from the original file structure:**
- Removed `src/extension.ts` — Vellum is not a pi coding-agent extension
- Removed `src/hooks/` directory — auto-compile is a prompt instruction, error parsing is in `server/compile.ts`, profile injection is in `prompts.ts`
- Renamed `src/web/app.ts` → `src/main.ts` — this is the browser entry point
- Added `src/server/` — Express server with API endpoints
- Added `src/renderers.ts` — `registerToolRenderer()` implementations
- Added `src/types.ts` — shared TypeBox schemas
- Added `vite.config.ts` — browser build configuration
- Added `public/` — static assets

---

## NixOS Deployment

Vellum's `flake.nix` exports a package and a NixOS module. The `.nix` repo (`jefffm/.nix`) consumes it:

```nix
# In flake.nix inputs:
inputs.vellum.url = "github:jefffm/vellum";

# In hosts/servoid/default.nix:
services.vellum = {
  enable = true;
  port = 3XXX;                          # pick an available port
  domain = "vellum.aoeu.pw";
  apiKeyFile = "/run/secrets/anthropic-key";  # sops-nix or agenix
};
```

The NixOS module provides:
- **systemd service** — runs the Express server (serves browser assets + API + LLM proxy)
- **LilyPond dependency** — `pkgs.lilypond` pinned at 2.24.x, reproducible, no version drift
- **Traefik integration** — reverse proxy with mTLS via step-ca
- **Secrets management** — API keys injected at runtime, never in the repo
- **Data directory** — `/var/lib/vellum/arrangements/` for saved arrangements

The Nix build:
1. `buildNpmPackage` builds the Express server + Vite browser bundle
2. LilyPond is a runtime dependency, not a build dependency
3. The `xlsx` CDN tarball URL in pi-web-ui's dependency tree may need lockfile patching for `fetchNpmDeps` — test early

This follows the same deployment pattern as the existing A2A adapter and Hermes agent on servoid.

---

## v1 Scope

### Infrastructure
- [ ] Set up pi-mono packages (`pi-agent-core`, `pi-web-ui`, `pi-ai`)
- [ ] Express server with API endpoints (`/api/stream`, `/api/compile`, `/api/instruments`, `/api/arrangements`, `/api/templates`)
- [ ] `streamProxy` integration for LLM API key security
- [ ] Vite build pipeline for browser bundle
- [ ] Install LilyPond via Nix (2.24.x)
- [ ] Create `flake.nix` with package + NixOS module
- [ ] Deploy on servoid behind Traefik

### Tools
- [ ] Define all `AgentTool<T>` objects with TypeBox schemas: `compile`, `tabulate`, `voicings`, `check_playability`, `transpose`, `diapasons`, `fretboard`
- [ ] Implement server-side `POST /api/compile` with LilyPond subprocess and structured error parsing
- [ ] Implement `tabulate` — pitch → position lookup against instrument profiles
- [ ] Implement `voicings` — chord voicing enumeration with stretch/campanella ranking
- [ ] Implement `check_playability` — stretch, same-course, RH pattern validation + difficulty rating
- [ ] Implement `transpose` — interval transposition with range validation and idiomatic key suggestions
- [ ] Implement `diapasons` — key → diapason tuning lookup table (5 standard schemes + override)
- [ ] Implement `fretboard` — SVG fretboard diagram renderer

### UI
- [ ] Wire `ChatPanel` + `ArtifactsPanel` with custom tool renderers
- [ ] `registerToolRenderer("compile", ...)` — inline SVG preview in chat
- [ ] `registerToolRenderer("fretboard", ...)` — inline fretboard diagram
- [ ] `registerToolRenderer("check_playability", ...)` — inline violation report

### Instrument Data
- [ ] Create instrument profiles (YAML + .ily) for all 7 instruments
- [ ] Include diapason tuning schemes in baroque lute profile
- [ ] Include stringing variants in baroque guitar profile
- [ ] Create LilyPond templates: `french-tab.ly` (with RhythmicStaff + hidden MIDI Staff), `solo-tab.ly`, `tab-and-staff.ly`, `grand-staff.ly`, `voice-and-tab.ly`, `voice-and-piano.ly`, `satb.ly`, `continuo.ly`
- [ ] French letter tablature working end-to-end (v1, not v2 — this is the native notation for the primary instrument)

### Agent
- [ ] System prompt with instrument profiles, workflow instructions, source-file-first guidance
- [ ] Prompt instructions for auto-compile behavior (call compile after generating .ly)
- [ ] Prompt instructions for artifacts panel updates (call artifacts tool after successful compile)

### Validation
- [ ] **Test piece: Dowland "Flow My Tears" (Lachrimae)** — see below
- [ ] **Test piece: "All Creatures of Our God and King" (LASST UNS ERFREUEN)** — hymnal SATB → baroque guitar conversion
- [ ] End-to-end: upload .ly source → arrange for baroque lute → French tab output → SVG preview → MIDI playback
- [ ] End-to-end: convert guitar tab → baroque lute French tab
- [ ] End-to-end: SATB hymnal → baroque guitar (punteado + rasgueado)
- [ ] Verify LilyPond French tab template with polyphonic voices + diapasons + ornaments

### Test Piece: Dowland "Flow My Tears" (Lachrimae)

**Recommendation:** John Dowland's "Flow My Tears" (from *The Second Booke of Songs or Ayres*, 1600) as the primary v1 test piece.

**Why this piece:**
- **Voice + lute** — exercises the voice-and-tab template, the most complex layout
- **Well-documented** — multiple modern editions available, public domain, IMSLP has facsimiles
- **Intabulation opportunity** — the vocal line can be intabulated for solo lute, testing instrument conversion
- **Tests diapasons** — the lute part uses bass courses that align with d-minor/A-minor diapason tuning
- **Ornaments** — period-appropriate trills and mordents in the lute part
- **Moderate difficulty** — intermediate-level lute writing, good for validating playability checks
- **Cultural significance** — one of the most famous English lute songs, widely recognized

**Test scenarios with this piece:**
1. Upload Dowland .ly source → compile → French tab + voice line
2. Arrange for solo lute (intabulation of the vocal part)
3. Convert to classical guitar (test instrument swap)
4. Revoice a passage (test iterative editing)
5. Change key (test transposition + diapason retuning)

**Secondary test piece:** BWV 996 Bourrée (Bach) — purely instrumental, tests baroque lute idiom without voice. Good for simpler validation if voice+tab proves complex.

### Test Piece 3: "All Creatures of Our God and King" (LASST UNS ERFREUEN)

**Hymnal → baroque guitar conversion test.** This tests the full real-world workflow: take a standard SATB + organ hymn setting and produce a playable baroque guitar arrangement.

**Why this piece:**
- **Tune is from 1623** (*Geistliche Kirchengesäng*, Cologne) — literally contemporaneous with the baroque guitar's golden age
- **Text by St. Francis of Assisi** (Canticle of the Sun, ~1225) — public domain, significant in Catholic tradition
- **Tests the hardest conversion pipeline** — SATB/organ → 5-course baroque guitar requires harmonic reduction, voice thinning, key transposition, and style decisions (rasgueado vs. punteado)
- **The Alleluia refrains** — repeated descending figures that naturally call for rasgueado (strummed) treatment, while verses suit punteado (plucked) melody + bass
- **Transposition test** — hymnals usually print this in D or Eb major; baroque guitar wants A minor or G major for idiomatic open-string usage with re-entrant tuning
- **Re-entrant tuning payoff** — courses 4-5 sounding an octave higher means strummed chords ring with natural brightness that organ can't replicate
- **Real liturgical use** — the output is something you could actually play at Mass or at home

**The conversion workflow this validates:**
```
Input:  SATB hymnal setting (PDF scan or MusicXML from hymnary.org)
Step 1: Extract melody (soprano) + harmony (chord analysis from SATB voices)
Step 2: Transpose to baroque-guitar-friendly key (D major → A minor or G major)
Step 3: Arrange verses as punteado (melody on courses 1-3, bass on 4-5)
Step 4: Arrange Alleluia refrains as rasgueado (alfabeto chord notation)
Step 5: Add period-appropriate ornaments
Output: French letter tab or number tab PDF + optional voice line
```

**Test scenarios:**
1. Upload SATB hymnal setting (MusicXML) → analyze harmony → produce baroque guitar arrangement
2. Generate both punteado (plucked) and rasgueado (strummed) sections within one piece
3. Test alfabeto chord notation for strummed passages
4. Convert the same hymn to classical guitar (compare voicing decisions)
5. Produce a voice + guitar version (melody line + guitar accompaniment)

## v2 Scope

- [ ] OSMD/VexFlow interactive score rendering for standard notation (guitar, piano, voice — **not** tablature, which stays LilyPond SVG)
- [ ] MIDI playback via Web Audio API (HTML artifact with embedded player)
- [ ] Bar-click interaction (click a bar → agent knows which bar to revoice)
- [ ] MusicXML import tool (JS parser)
- [ ] MusicXML export (via MuseScore CLI on server, or custom writer)
- [ ] Fretboard visualization with position overlay (interactive, beyond static SVG)
- [ ] Arrangement library with server-side session persistence (beyond IndexedDB)
- [ ] Session branching for "try it this way" workflows
- [ ] Figured bass realization workflow
- [ ] Batch conversion (whole suites at once)
- [ ] Configurable ornament table per style period (Gaultier, Mouton, Weiss defaults)
- [ ] Additional instrument profiles: archlute, mandora, vihuela, 7-course Dowland lute, 10-course Renaissance lute
- [ ] Automated pitch verification tool (compare against melody database)
- [ ] German tablature support (evaluate demand vs. effort)
- [ ] Voice text underlay mechanics (lyrics aligned to notes)
- [ ] Piano pedaling model (systematic Ped/senza ped markings)

---

## Technology Decision

### Chosen: pi-mono Web App + NixOS Deployment

The core realization: **v1 needs almost no code for the musical intelligence.** The LLM does the arrangement. LilyPond does the engraving. What v1 needs is:
1. A conversational interface with visual feedback
2. Native tools that handle mechanical correctness
3. A way to run LilyPond server-side
4. A clean client-server split that keeps API keys secure

Pi-mono provides #1 out of the box (`pi-web-ui` ChatPanel + ArtifactsPanel, `pi-agent-core` Agent loop + tool framework). Vellum provides #2 (custom `AgentTool<T>` objects with server API backends). NixOS provides #3 and deployment (#4 via Traefik + mTLS + streamProxy).

**Why pi-mono over building from scratch:**
- Pi already provides the agent loop, tool framework, web UI, artifact display, session storage, and LLM proxy
- Building these from scratch would replicate what pi does, but worse
- Pi's `AgentTool<T>` pattern with TypeBox schemas maps perfectly to Vellum's domain tools
- `registerToolRenderer()` enables inline visual feedback (SVG preview, fretboard diagrams) in the chat stream
- The `ArtifactsPanel` handles the tablature workbench with no custom code (SVG is a built-in artifact type)
- `streamProxy` solves the API key security problem cleanly

### Alternative Considered: Python + music21

**Strengths:**
- **music21** is the only comprehensive music theory library in any language
- Fastest prototype path for parsing and transposition

**Weaknesses:**
- Runtime type errors in production
- Dependency management fragility
- music21 doesn't help with the hard part (instrument-specific tab math, playability)
- No web UI path without a second language
- The LLM handles what music21 is best at (musical analysis, arrangement decisions)

**Verdict:** music21 solves the wrong problem. The LLM replaces its analytical capabilities; custom tools replace its computational ones.

### Alternative Considered: Custom TypeScript + Rust/WASM

**Strengths:**
- Maximum control, Rust for correctness-critical math

**Weaknesses:**
- Rebuilds the agent loop, web UI, session management from scratch
- LilyPond can't run in the browser anyway — WASM doesn't help with the main pipeline
- Over-engineered for v1

**Verdict:** Revisit in v2 if tool performance becomes a bottleneck (e.g., batch voicing enumeration).

### Alternative Considered: Pure Prompt Engineering (Skill file + bash)

**Strengths:**
- Zero code — just a system prompt with instrument profiles

**Weaknesses:**
- LLM invents fret positions from training data (error-prone)
- Compilation errors come back as raw stderr
- No visual feedback — human downloads PDF to check
- No playability validation
- Every arrangement burns tokens on mechanical correctness the tools should handle

**Verdict:** This is where the project started. Native tools are the difference between "an agent that can sort of do this" and "an agent that's genuinely good at this."

---

## References

- [pi-mono](https://github.com/badlogic/pi-mono) — AI agent toolkit (coding agent, unified LLM API, web UI components)
- [pi-web-ui](https://www.npmjs.com/package/@mariozechner/pi-web-ui) — Reusable web UI components for AI chat interfaces
- [pi-agent-core](https://www.npmjs.com/package/@mariozechner/pi-agent-core) — Agent loop, tool framework, streamProxy
- [LilyPond Tablature docs](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-fretted-strings) — fretted string notation
- [LilyPond Lute tablature](https://lilypond.org/doc/v2.24/Documentation/notation/lute-tablatures) — French tab, diapasons, `fret-letter-tablature-format`
- [Fronimo](https://sites.google.com/view/fronimo/home) — reference for historical tablature rendering
- [MEI Tablature encoding](https://music-encoding.org/guidelines/v5/content/tablature.html) — future interchange format
- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) — browser MusicXML rendering (standard notation only, not tablature)
- Nigel North, *Continuo Playing on the Lute, Archlute and Theorbo* — baroque lute tuning reference
- Robert Dowland, *Varietie of Lute Lessons* (1610) — ornament tables
- James Tyler & Paul Sparks, *The Guitar and its Music* (2002) — baroque guitar stringing evidence
- Gaspar Sanz, *Instrucción de música sobre la guitarra española* (1674) — stringing taxonomy
