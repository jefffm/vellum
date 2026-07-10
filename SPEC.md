# Vellum — ve*LLM*um

> The writing surface where musical sources become informed arrangements.

## Overview

Vellum is an AI-assisted music arrangement tool for historical plucked string instruments, classical guitar, piano, and voice. It renders properly formatted tablature and standard notation via LilyPond.

**The key insight:** Musical intelligence is shared by a hybrid **Musicological Engine**. Deterministic symbolic analysis establishes musical facts; curated historical knowledge supplies period, regional, contrapuntal, continuo, instrument, and notation practices; the LLM interprets ambiguity and proposes creative alternatives; and constraint checks verify preservation, playability, and engraving. The system preserves its evidence and decisions as structured analysis rather than leaving musical truth inside one model response.

Curated historical knowledge is source-backed and explicitly scoped by period, region, genre, instrument, and ensemble role. The engine distinguishes documented practice, modern editorial convention, and Vellum heuristics, and preserves conflicting authorities as inspectable alternatives.

The Historical Knowledge Base combines reviewed, versioned Knowledge Packs with an Owner Reference Library. Locally added references yield cited Knowledge Candidates that require review before promotion; uncited model memory or live web results are not historical authority.

State is divided into durable Arrangement Workspaces, cross-project Personal Defaults, and a reviewed Historical Knowledge Base. Workspace corrections save automatically; reusable claims require explicit source-backed promotion before they become global knowledge.

Vellum may notice equivalent choices recurring across distinct Arrangement
Workspaces and propose a **Personal Default Candidate**. The proposal shows the
choices that motivated it and an explicit scope—such as target instrument, tuning,
Notation Layout, task, or repertoire context—but has no behavioral effect until
the Owner approves it. Approved defaults are visible, editable, releasable, and
removable. Rejected candidates do not repeatedly nag unless materially different
evidence suggests a new scope. Applied defaults are disclosed in the Arrangement
Brief and remain soft personal preferences, never source evidence, historical
authority, Editorial Commitments, or hidden hard constraints.

Personal Defaults have the lowest precedence in musical decision-making. They
yield automatically to source evidence, applicable Historical Practice Claims,
Preservation Targets, Editorial or Family Commitments, and hard instrument or
validation constraints. An unapplied default remains available for other contexts
and appears with the exact score-anchored or profile-backed reason it did not
apply. The conflict is non-blocking unless the Owner explicitly promotes the
choice into the current arrangement; overriding historical or preservation
constraints requires changing the relevant profile, policy, or commitment rather
than strengthening a Personal Default.

Musical state has explicit versioned lineage: immutable Source Artifacts produce correctable Score Transcriptions, derived Normalized Scores, Analysis Records, Arrangement Scores, and reproducible Deliverables. No transformation silently rewrites an upstream layer.

The lineage is dependency-aware. A new Score Transcription version automatically
recomputes deterministic normalization and analysis. Applicable user corrections
are carried forward explicitly, while corrections whose score anchors no longer
resolve are returned for review. Creative downstream work is never silently
replaced: existing Arrangement Scores, Performance Interpretations, and
Deliverables remain available as **Stale Derivations**, with the changed upstream
dependency identified. Regeneration is an explicit action that creates a new
version and supports comparison with the preserved result.

The default regeneration path is **Conservative Regeneration**. It descends from
the stale Arrangement Score, carries forward user-authored or explicitly approved
**Editorial Commitments**, and limits generation changes to the dependency region
affected by the corrected source. A commitment that conflicts with corrected
source material or a hard constraint becomes a targeted conflict; it is never
silently discarded. The new arrangement still receives a complete Preservation
Audit and all applicable validation. A fresh Arrangement Search remains available
when the user wants the entire solution reconsidered.

Each Arrangement Score realizes one exact **Target Configuration**: its solo or
ensemble instruments, roles, tunings, stringing, and playability-relevant
capabilities. French tablature, a Learning Layout, PDF, and browser notation can be
different projections of that same score. Changing the target instrument, role,
tuning, or stringing produces a sibling Arrangement Score in an **Arrangement
Family**, not another layout. Family members share their Arrangement Brief and
source-analysis lineage but run independent Arrangement Search, candidate ranking,
playability validation, Preservation Audit, and version history.

Editorial Commitments are target-local by default. A user may explicitly promote a
musically portable choice—such as a countermelody, cadence, or protected texture—to
a **Family Commitment** applying to selected or future Target Configurations.
Instrument-specific course, fret, fingering, diapason, tuning, or stringing choices
remain local. Source corrections are made once in the Score Transcription or
Analysis Record rather than copied into family constraints. Changing a Family
Commitment marks affected sibling scores stale and offers Conservative Regeneration
for each; infeasibility creates a target-local Commitment Conflict without
invalidating feasible siblings.

Every direct user edit to an Arrangement Score becomes an Editorial Commitment by
default. Model-generated material becomes committed only when the user edits or
explicitly approves it. The UI provides **Let Vellum reconsider**, which releases
the selected commitment for future regeneration but does not revert the current
score or erase the version in which the choice was made. Corrections to the Score
Transcription remain evidence-layer corrections and are not mislabeled as
arrangement commitments.

Editorial Commitments are semantic rather than coarse score locks. Each commitment
records stable score or relationship anchors, an optional temporal region, and a
**Commitment Scope** identifying the protected dimension: Principal Voice pitch,
rhythm, harmony, bass, Texture, contrapuntal relationship, ornament, notation, or
course/fingering assignment. A direct edit creates the narrowest implied scope—for
example, changing a course assignment preserves the fingering without freezing
unrelated rhythm or harmony. The user may explicitly broaden the scope to a note
group, voice, phrase, measure range, section, or whole arrangement. An anchor that
no longer resolves becomes a targeted review item; Vellum does not silently widen
or discard the commitment.

If a commitment cannot coexist with corrected source evidence, a Preservation
Target, or another hard constraint, Vellum creates a score-anchored **Commitment
Conflict** and blocks completion. It presents the applicable explicit resolutions:

1. release the Editorial Commitment for future generation;
2. revise the Score Transcription if the recognized evidence is wrong, producing a
   new evidence-layer version and dependency recomputation; or
3. approve a versioned Policy Exception identifying the affected commitment,
   Preservation Target or constraint, musical consequence, rationale, and Owner
   approval.

The chosen resolution creates new versioned state. Vellum never silently favors
either source fidelity or a user edit, and Commitment Conflicts and Policy
Exceptions remain visible in the Preservation Audit rather than disappearing into
a bulk approval action.

A localized, Owner-approved Policy Exception can remain compatible with Faithful
Reduction; the audit reports **pass with exceptions** and discloses the deviation.
The audit also evaluates all exceptions together by musical consequence rather
than applying an arbitrary count. One critical exception—or several local
exceptions whose combined effect materially compromises a Preservation Target or
the work's recognizable identity—produces **Policy Drift** and fails Faithful
Reduction. Completion then requires revising the arrangement or explicitly
changing the Preservation Policy, which creates a new Arrangement Score version
and a new audit. Vellum cannot preserve the Faithful Reduction label by splitting
a broad rewrite into many small exceptions.

Every Arrangement Score also carries a policy-independent **Transformation
Report**. It maps source events and relationships to their arrangement descendants
and classifies retained, transposed, octave-relocated, revoiced, reharmonized,
omitted, and newly generated material with its rationale. Under Faithful Reduction
the Preservation Audit evaluates this map as a hard completion gate. Under
Idiomatic Adaptation and Free Paraphrase it remains a complete, inspectable report
rather than enforcing note-level fidelity. Instrument mechanics, explicit
commitments, and applicable hard Validation Findings continue to gate every policy.

The workbench can render the Transformation Report as a toggleable **Provenance
Overlay** on linked source and arrangement notation. It distinguishes retained,
transformed, omitted, and generated material using labels, icons, or patterns as
well as color. Many-to-many transformations remain navigable; omitted events are
marked at their source or timeline position even when the arrangement has no glyph
to select. Activating a marker opens the linked objects, transformation class,
rationale, evidence, applicable policy, and audit outcome. The overlay is
diagnostic UI state: it neither clutters the normal view by default nor changes the
Arrangement Score or ordinary Deliverables.

**The product is a local-first pi-mono web app** — a custom application built on [pi-mono](https://github.com/badlogic/pi-mono)'s agent toolkit and run primarily on its Owner's machine. The browser hosts the conversational agent and live score workbench. Local services provide the Musicological Engine, LilyPond, source storage, durable workspaces, and model-provider proxying. Nix remains a reproducible packaging option and may support private remote access, but servoid is not the primary runtime.

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
│  │    check_playability, transpose, diapasons, fretboard,    │ │
│  │    analyze, lint, theory                                  │ │
│  │  • System prompt with instrument profiles                 │ │
│  │  • LLM calls → streamProxy → server /api/stream           │ │
│  │                                                            │ │
│  │  Each tool's execute() calls server REST API:              │ │
│  │    fetch("/api/compile", { body: lySource })               │ │
│  │    fetch("/api/analyze", { body: musicxml })               │ │
│  │    fetch("/api/lint", { body: passage })                   │ │
│  │    etc.                                                    │ │
│  │                                                            │ │
│  │  theory() runs locally via tonal.js (no server call)       │ │
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
                       │  localhost HTTP
                       │
Owner machine          │
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
│  ├─ GET  /api/templates/:name  LilyPond template source          │
│  │                                                               │
│  ├─ POST /api/analyze         Accepts MusicXML string. Calls     │
│  │                            music21 (Python subprocess):       │
│  │                            parse → chordify → key analysis    │
│  │                            → Roman numerals. Returns:         │
│  │                            { key, chords[], voices[], time }  │
│  │                                                               │
│  ├─ POST /api/lint            Accepts passage (LilyPond or       │
│  │                            structured note data). Calls       │
│  │                            music21 voice leading analysis.    │
│  │                            Returns: { violations[] } with     │
│  │                            measure/beat locations             │
│  │                                                               │
│  ├─ POST /api/chordify        Accepts MusicXML. Returns          │
│  │                            chord-per-beat reduction via        │
│  │                            music21 chordify()                 │
│  │                                                               │
│  ├─ POST /api/realize         (v2) Figured bass realization      │
│  │                            via music21 figuredBass.realizer   │
│  │                                                               │
│  │  ┌───────────────────────────────────────────────────────┐   │
│  │  │  Music Theory Engine (Python / music21)                │   │
│  │  │  Called as subprocess by /api/analyze, /api/lint,      │   │
│  │  │  /api/chordify, /api/realize                           │   │
│  │  │  Same deployment pattern as LilyPond — pinned via Nix  │   │
│  │  └───────────────────────────────────────────────────────┘   │
│                                                                 │
│  LilyPond (Nix package, pinned 2.24.x)                          │
│  └─ Called as subprocess by /api/compile                         │
│                                                                 │
│  music21 (Nix package, python3Packages.music21)                  │
│  └─ Called as subprocess by /api/analyze, /api/lint,             │
│     /api/chordify, /api/realize                                  │
│                                                                 │
│  instruments/*.yaml + *.ily   (served via /api/instruments)      │
│  templates/*.ly               (served via /api/templates)        │
│                                                                 │
│  Local data + optional private remote-access boundary            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Agent in browser, not server.** Pi-web-ui's `ChatPanel` requires a local `Agent` instance via `chatPanel.setAgent(agent)`. Running the Agent server-side would require a custom WebSocket/SSE transport layer and lose most of pi-web-ui's built-in functionality. Browser-side Agent with server API calls is the natural pi-mono pattern.

**LLM proxy via streamProxy.** Pi-agent-core provides `streamProxy` for routing LLM API calls through a server endpoint. This keeps API keys (Anthropic, OpenAI, etc.) server-side while the Agent runs in the browser. The browser never sees the API key.

**Vellum-owned Provider Connection.** The local server initiates ChatGPT OAuth through Pi's public provider API, receives the localhost callback, stores and refreshes credentials in Vellum-controlled secure local storage, and reports connection state to the browser. Vellum does not read Pi or Codex credential files. API keys remain a fallback, and the provider-specific flow stays behind a replaceable adapter.

**Disconnected operation.** Provider availability gates only durable **Model
Actions**. PDF/MusicXML import, Score-Anchored Review, direct editing,
deterministic analysis, validation, engraving, workspace access, and Audio Preview
continue locally when ChatGPT authorization expires or the network is unavailable.
Before provider work begins, a Model Action records exact input versions and the
last confirmed canonical boundary. Incomplete responses never partially update a
Score Transcription, Analysis Record, Arrangement Candidate, Arrangement Score, or
Historical Knowledge Base. Interrupted actions remain inspectable, cancellable,
and safely retryable after reconnection without replaying already committed state.
Provider errors never delete or lock local musical work.

Reconnection does not automatically resume creative Model Actions. The workspace
shows each interrupted action with explicit **Retry** and **Cancel** controls, its
exact original inputs, completed local tool results, partial progress summary,
interruption reason, and last confirmed version boundary. Partial model text can
remain in diagnostic history but cannot become canonical musical state. Retrying
uses the action's durable identity and idempotency boundary so it cannot duplicate
already committed results or issue an undisclosed provider request.

Before Retry, Vellum compares the action's recorded inputs with current workspace
versions. If they differ, the UI offers two explicit paths:

- **Retry on current version** (default): create a revalidated attempt against
  current state while retaining the original intent and an input-difference
  summary.
- **Retry original snapshot as a branch**: create an internal **Arrangement
  Branch** rooted at the exact prior versions and continue the earlier intention
  without overwriting or reverting current work.

Both attempts remain linked to the interrupted Model Action and its durable
idempotency boundary. An Arrangement Branch is musical version lineage inside the
workspace, not a copied workspace or Git branch.

**Tool execution pattern.** Each tool's `execute()` method runs in the browser but makes `fetch()` calls to server endpoints for anything requiring server resources. Pure-computation tools (tabulate, voicings, check*playability) \_could* run entirely in the browser — instrument profiles are loaded at init — but routing through the server keeps the browser bundle small and instrument data authoritative. The `theory` tool is the exception: it runs entirely in the browser via tonal.js for instant lookups with no server round-trip. For v1, all other tools call the server.

**Instrument profiles: dual location.** YAML profiles are served to the browser (for system prompts and tool context). `.ily` include files stay on the server (only LilyPond needs them). Both live in `instruments/` on disk; the server API handles the split.

### Why Native Tools Beat Generic Agent + Bash

A general-purpose agent with bash access can technically run LilyPond. But:

| Generic agent                                          | Vellum                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| LLM writes raw .ly hoping it compiles                  | LLM calls `voicings()` to get playable options, picks the best one                                         |
| `bash lilypond foo.ly` → 200 lines of stderr           | `compile()` → structured errors: "Bar 8: stretch violation on course 3"                                    |
| LLM invents fret positions from training data          | `tabulate()` returns all valid positions with idiomatic ranking                                            |
| No verification until compile fails                    | `check_playability()` catches impossible fingerings before compilation                                     |
| LLM does interval arithmetic in its head (error-prone) | `theory()` returns exact answers instantly via tonal.js                                                    |
| LLM guesses at chord progressions from SATB score      | `analyze()` returns Roman numeral analysis via music21                                                     |
| No voice leading verification                          | Contextual validation classifies score-anchored findings under an explicit historical and textural profile |
| Human reads PDF to check quality                       | Browser shows live preview, fretboard diagrams, MIDI playback                                              |

The LLM participates in musical judgment, but it does not own musical truth. Structured analysis, historical profiles, and constraint checks make the result inspectable and resilient to model changes.

---

## Technology Stack

### pi-mono Integration

Vellum is built on [pi-mono](https://github.com/badlogic/pi-mono), an open-source AI agent toolkit:

| Package         | Role in Vellum                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `pi-agent-core` | Agent loop, tool definitions (`AgentTool<T>`), tool execution, `streamProxy` for LLM API proxying      |
| `pi-web-ui`     | `ChatPanel`, `AgentInterface`, `ArtifactsPanel`, `registerToolRenderer()`, `SessionsStore` (IndexedDB) |
| `pi-ai`         | Multi-provider LLM API (Anthropic, OpenAI, Google, etc.) — consumed via streamProxy on the server      |

Pi-mono provides the agent infrastructure. Vellum provides the domain-specific tools, instrument knowledge, and UI customizations that transform a generic agent into a music arrangement specialist.

### Browser Stack

- **pi-web-ui** — `ChatPanel` + `ArtifactsPanel` web components (the entire UI shell)
- **pi-agent-core** — `Agent` class, `AgentTool<T>` definitions (runs in browser)
- **tonal.js** — browser-side music theory library for instant lookups (intervals, chord detection, scale membership, Roman numeral parsing). Powers the `theory` tool with zero server round-trip
- **Vite** — build tool, bundles the browser application
- **Custom tool renderers** — `registerToolRenderer()` for inline SVG preview, fretboard diagrams, playability reports in the chat stream

### Server Stack

- **Node.js** ≥ 20 + **Express** — API server, static asset serving, LLM proxy
- **LilyPond** ≥ 2.24 — music engraving subprocess, pinned as a Nix dependency
- **Python 3** + **music21** — music theory engine subprocess. Handles MusicXML parsing, harmonic analysis (chordify, key detection, Roman numerals), voice leading lint (parallel fifths/octaves, voice crossing, spacing), and figured bass realization (v2). Pinned as a Nix dependency (`python3Packages.music21`)
- **Local process supervisor or desktop shell** — starts the browser UI and services
- **Nix** — reproducible LilyPond, Python, OMR, and optional NixOS packaging
- **Private remote access** — optional and outside the primary local trust boundary

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
  format: Type.Optional(
    Type.Union([Type.Literal("svg"), Type.Literal("pdf"), Type.Literal("both")], { default: "svg" })
  ),
});

// Tool result details type (for UI rendering via registerToolRenderer)
interface CompileDetails {
  svg?: string;
  pdf?: string; // base64-encoded
  midi?: string; // base64-encoded
  errors: CompileError[];
}

// AgentTool definition
const compileTool: AgentTool<typeof CompileParams, CompileDetails> = {
  name: "compile",
  description:
    "Compile LilyPond source into rendered tablature/notation. " +
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
      signal, // respect cancellation
    });
    const data = await res.json();

    if (data.errors?.length > 0) {
      return {
        content: [
          {
            type: "text",
            text:
              `Compilation failed with ${data.errors.length} error(s):\n` +
              data.errors
                .map((e: CompileError) => `  Bar ${e.bar}, beat ${e.beat}: ${e.message}`)
                .join("\n"),
          },
        ],
        details: { errors: data.errors, svg: undefined, pdf: undefined, midi: undefined },
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Compiled successfully. SVG rendered (${data.barCount} bars, ${data.voiceCount} voices). No errors.`,
        },
      ],
      details: {
        svg: data.svg,
        pdf: data.pdf,
        midi: data.midi,
        errors: [],
      },
    };
  },
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
  },
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
  },
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

| Instrument             | Good keys                                   | Why                                |
| ---------------------- | ------------------------------------------- | ---------------------------------- |
| Baroque lute (d-minor) | D minor, A minor, F major, G minor, C major | Open strings align with key center |
| Baroque guitar         | A minor, E minor, C major, G major, D minor | Standard guitar-adjacent keys      |
| Renaissance lute (G)   | G major, D minor, C major, A minor          | Open-string keys                   |
| Theorbo                | D minor, G minor, A minor                   | Continuo keys, diapason alignment  |
| Classical guitar       | E minor, A minor, D major, G major, C major | Standard repertoire keys           |

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

| Key Center         | 7   | 8   | 9   | 10  | 11  | 12  | 13  | Name                           |
| ------------------ | --- | --- | --- | --- | --- | --- | --- | ------------------------------ |
| D minor / F major  | G   | F   | E♭  | D   | C   | B♭  | A   | _Accord ordinaire_ (standard)  |
| A minor / C major  | G   | F   | E♮  | D   | C   | B♮  | A   | Natural 3rd and 7th            |
| G minor / B♭ major | G   | F   | E♭  | D   | C   | B♭  | A   | Same as standard (coincidence) |
| D major (rare)     | G   | F♯  | E♮  | D   | C♯  | B♮  | A   | Sharp keys (Weiss)             |
| E minor            | G   | F♯  | E♮  | D   | C♮  | B♮  | A   | Natural with F♯                |

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

### Three-Layer Tool Architecture

The tools form three layers. Each layer answers a different question:

```
Layer 3: Musical Judgment (LLM)         — "Does this sound good?"
         Voice leading, arrangement decisions, idiom, style choices.
         This is what the LLM is uniquely good at.

Layer 2: Musicological Analysis and Validation — "Which musical expectations apply here?"
         Harmonic, formal, textural, contrapuntal, continuo, and profile-scoped findings
         rules (parallel 5ths/8ves, voice crossing), interval math,
         chord identification. Deterministic — no LLM needed.

Layer 1: Instrument Mechanics (tabulate, voicings, check_playability, etc.)
                                         — "Can this be played?"
         Pitch-to-fret mapping, stretch validation, course conflicts,
         re-entrant tuning, diapason availability. Instrument-specific.
```

Without Layer 2, the model must do interval arithmetic, chord identification, profile selection, voice-leading evaluation, and harmonic analysis in its head. The Musicological Engine separates low-level observations from their contextual consequence: `check_playability` establishes physical feasibility, while a Validation Profile determines whether a parallel fifth, crossing, suspension, or doubling is prohibited, discouraged, or normal in that passage.

### analyze

Parses a score and returns harmonic analysis. Server-side — calls music21 via Python subprocess. This is the critical first step for any conversion workflow (hymnal → guitar, voice+piano → lute, etc.).

**Parameters:**

```typescript
const AnalyzeParams = Type.Object({
  source: Type.String({
    description: "MusicXML source as string, or base64-encoded MusicXML file",
  }),
  format: Type.Optional(
    Type.Union([Type.Literal("musicxml"), Type.Literal("lilypond")], { default: "musicxml" })
  ),
});
```

**Server endpoint:** `POST /api/analyze`

**music21 operations:** `converter.parse()` → `score.analyze('key')` → `score.chordify()` → `roman.romanNumeralFromChord()` for each chord → extract part ranges

**Returns to LLM:**

```
Key: D major
Time: 4/4
Voices: Soprano (D4–D5), Alto (A3–A4), Tenor (D3–D4), Bass (G2–D3)
Chord progression (Roman numerals):
  Bar 1: I | V6 | vi | IV
  Bar 2: ii | V7 | I | I
  ...
```

**Returns to UI:** `{ key, timeSignature, voices[], chords[] }` — structured analysis data, potentially rendered as a chord chart.

### lint

Produces low-level voice-leading observations and contextual Validation Findings. Server-side analyzers such as music21 establish intervallic facts; the selected Validation Profile classifies their consequence.

**Parameters:**

```typescript
const LintParams = Type.Object({
  source: Type.String({ description: "LilyPond or MusicXML passage to check" }),
  validation_profile_id: Type.String(),
  format: Type.Optional(
    Type.Union([Type.Literal("lilypond"), Type.Literal("musicxml")], { default: "lilypond" })
  ),
  rules: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("parallel_fifths"),
        Type.Literal("parallel_octaves"),
        Type.Literal("voice_crossing"),
        Type.Literal("spacing"),
        Type.Literal("direct_octaves"),
        Type.Literal("unresolved_leading_tone"),
        Type.Literal("all"),
      ]),
      { default: ["all"] }
    )
  ),
});
```

**Server endpoint:** `POST /api/lint`

**music21 operations:** Parse score → extract voice pairs → `VoiceLeadingQuartet` observations for parallel motion, voice crossing, spacing, and directed resolution. The Musicological Engine then classifies observations under the requested Validation Profile.

**Returns to LLM:**

```
3 findings under renaissance-imitative-vocal:
  HARD — Bar 4, beat 1: parallel fifths between structural outer voices
  SOFT — Bar 7, beat 3: brief voice crossing during imitation
  OBSERVATION — Bar 12, beat 1: scale degree 7 descends in an inner voice
```

**Returns to UI:** `{ violations[] }` with measure/beat locations, voice names, and violation types. Rendered inline as a diagnostic report.

### theory

Browser-side music theory calculations via tonal.js. No server round-trip — instant results for quick lookups during arrangement. This is the lightweight complement to the server-side music21 tools.

**Parameters:**

```typescript
const TheoryParams = Type.Object({
  operation: Type.Union([
    Type.Literal("interval"), // distance between two notes
    Type.Literal("transpose"), // transpose a pitch by an interval
    Type.Literal("chord_detect"), // identify chord from notes
    Type.Literal("chord_notes"), // spell out a chord's notes
    Type.Literal("scale_notes"), // notes in a scale
    Type.Literal("scale_chords"), // diatonic chords in a key
    Type.Literal("roman_parse"), // parse Roman numeral → chord in key
    Type.Literal("enharmonic"), // enharmonic equivalents
  ]),
  args: Type.Record(Type.String(), Type.Any(), {
    description:
      "Operation-specific arguments. interval: {from, to}. " +
      "transpose: {note, interval}. chord_detect: {notes: string[]}. " +
      "chord_notes: {chord}. scale_notes: {tonic, scale}. " +
      "scale_chords: {tonic, scale}. roman_parse: {numeral, key}. " +
      "enharmonic: {note}.",
  }),
});
```

**Runs in browser** — no `fetch()` call. Uses `@tonaljs/tonal` directly.

**Example operations:**

```
theory("interval", { from: "C4", to: "G4" })        → "P5"
theory("transpose", { note: "F#4", interval: "m3" }) → "A4"
theory("chord_detect", { notes: ["C", "E", "G"] })   → "C major"
theory("chord_notes", { chord: "Dm7" })               → ["D", "F", "A", "C"]
theory("scale_chords", { tonic: "A", scale: "minor" })→ ["Am", "Bdim", "C", "Dm", "Em", "F", "G"]
theory("roman_parse", { numeral: "V7", key: "D" })    → "A7" → ["A", "C#", "E", "G"]
```

**Returns to LLM:** Text result of the calculation.

**Returns to UI:** `{ operation, result }` — no special renderer needed; text is sufficient.

---

## Agent Setup

### Browser Entry Point

The main browser entry point creates the Agent, registers tool renderers, and wires up the ChatPanel:

```typescript
// src/main.ts
import { Agent } from "@mariozechner/pi-agent-core";
import { ChatPanel, ArtifactsPanel, registerToolRenderer } from "@mariozechner/pi-web-ui";
import {
  compileTool,
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  transposeTool,
  diapasonsTool,
  fretboardTool,
  analyzeTool,
  lintTool,
  theoryTool,
} from "./tools";
import { compileRenderer, fretboardRenderer, playabilityRenderer } from "./renderers";

// Register custom tool renderers (inline visual feedback in chat)
registerToolRenderer("compile", compileRenderer);
registerToolRenderer("fretboard", fretboardRenderer);
registerToolRenderer("check_playability", playabilityRenderer);

// Load instrument profiles for system prompt
const instruments = await fetch("/api/instruments").then((r) => r.json());

// Create Agent with all tools
const agent = new Agent({
  initialState: {
    tools: [
      compileTool,
      tabulateTool,
      voicingsTool,
      checkPlayabilityTool,
      transposeTool,
      diapasonsTool,
      fretboardTool,
      analyzeTool,
      lintTool,
      theoryTool,
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
- Call `analyze` when given a MusicXML file — get key, chord progression, voice ranges
- Call `lint` after generating an arrangement — catch parallel fifths, voice crossing, spacing errors
- Call `theory` for quick music theory lookups — intervals, chord names, scale degrees

## Workflow

1. When given a source file (.ly, MusicXML), read it first
2. When given MusicXML, call `analyze` to get harmonic analysis before arranging
3. When arranging from memory, warn the user: "I'm working from memory —
   please verify the pitches against a reference score"
4. Use tools for all mechanical decisions (positions, voicings, playability)
5. After generating an arrangement, call `lint` to verify voice leading
6. Always compile and verify before presenting the final result
7. After a successful compile, use the artifacts tool to update the tablature
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
fretted_courses: 6 # courses 1-6 have frets
open_courses: 7 # courses 7-13 are diapasons (unfretted bass)
tuning: # highest to lowest
  - { course: 1, pitch: "f'", note: "F4" } # chanterelle
  - { course: 2, pitch: "d'", note: "D4" }
  - { course: 3, pitch: "a", note: "A3" }
  - { course: 4, pitch: "f", note: "F3" }
  - { course: 5, pitch: "d", note: "D3" }
  - { course: 6, pitch: "a,", note: "A2" }
  # Diapasons (open bass strings, tuned diatonically — varies by key)
  - { course: 7, pitch: "g,", note: "G2" }
  - { course: 8, pitch: "f,", note: "F2" }
  - { course: 9, pitch: "e,", note: "E2" }
  - { course: 10, pitch: "d,", note: "D2" }
  - { course: 11, pitch: "c,", note: "C2" }
  - { course: 12, pitch: "b,,", note: "B1" } # sometimes Bb
  - { course: 13, pitch: "a,,", note: "A1" }
frets: 8 # typically 8 frets on the neck
diapason_schemes: # standard tunings by key (courses 7-13)
  d_minor: ["G", "F", "Eb", "D", "C", "Bb", "A"] # accord ordinaire
  a_minor: ["G", "F", "E", "D", "C", "B", "A"] # natural 3rd/7th
  g_minor: ["G", "F", "Eb", "D", "C", "Bb", "A"] # same as standard
  d_major: ["G", "F#", "E", "D", "C#", "B", "A"] # sharp keys
  e_minor: ["G", "F#", "E", "D", "C", "B", "A"] # natural with F#
constraints:
  - "Diapasons (courses 7-13) cannot be fretted — open only"
  - "Maximum left-hand stretch: ~4 frets on upper courses"
  - "Thumb plays courses 4-13; index-middle alternate on 1-3"
  - "Campanella encouraged — let notes ring across courses"
  - "Brisé (broken chord) texture is idiomatic, especially in French style"
  - "Right-hand thumb-under technique for bass runs"
notation: "french-letter" # a=0, b=1, c=2, d=3, e=4, f=5, g=6, h=7
```

### Baroque Guitar (5-course, re-entrant)

```yaml
id: baroque-guitar-5
name: "5-Course Baroque Guitar"
courses: 5
fretted_courses: 5
open_courses: 0
tuning: # nominal pitches (actual sounding depends on stringing)
  - { course: 1, pitch: "e'", note: "E4" }
  - { course: 2, pitch: "b", note: "B3" }
  - { course: 3, pitch: "g", note: "G3" }
  - { course: 4, pitch: "d'", note: "D4", re_entrant: true }
  - { course: 5, pitch: "a", note: "A3", re_entrant: true }
frets: 8
stringing: "french" # default; options: "french", "italian", "mixed"
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
notation: "french-letter" # or italian-number depending on source tradition
```

### Renaissance Lute (6-course, G)

```yaml
id: renaissance-lute-6
name: "6-Course Renaissance Lute (G tuning)"
courses: 6
fretted_courses: 6
open_courses: 0
tuning:
  - { course: 1, pitch: "g'", note: "G4" }
  - { course: 2, pitch: "d'", note: "D4" }
  - { course: 3, pitch: "a", note: "A3" }
  - { course: 4, pitch: "f", note: "F3" }
  - { course: 5, pitch: "c", note: "C3" }
  - { course: 6, pitch: "g,", note: "G2" }
frets: 8
constraints:
  - "All courses fretted"
  - "Thumb-index alternation standard"
  - "Simpler voice leading than baroque lute"
  - "Intabulation of vocal polyphony is core repertoire"
notation: "italian-number" # or french-letter
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
  - { course: 1, pitch: "a", note: "A3" } # octave down from lute
  - { course: 2, pitch: "e", note: "E3" } # octave down from lute
  - { course: 3, pitch: "b", note: "B3" }
  - { course: 4, pitch: "g", note: "G3" }
  - { course: 5, pitch: "d", note: "D3" }
  - { course: 6, pitch: "a,", note: "A2" }
  # Diapasons
  - { course: 7, pitch: "g,", note: "G2" }
  - { course: 8, pitch: "f,", note: "F2" }
  - { course: 9, pitch: "e,", note: "E2" }
  - { course: 10, pitch: "d,", note: "D2" }
  - { course: 11, pitch: "c,", note: "C2" }
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
  - { string: 1, pitch: "e'", note: "E4" }
  - { string: 2, pitch: "b", note: "B3" }
  - { string: 3, pitch: "g", note: "G3" }
  - { string: 4, pitch: "d", note: "D3" }
  - { string: 5, pitch: "a,", note: "A2" }
  - { string: 6, pitch: "e,", note: "E2" }
frets: 19
constraints:
  - "Standard concert tuning"
  - "Maximum left-hand stretch: ~5 frets in lower positions, ~4 above 7th"
  - "Thumb plays strings 4-6; i-m-a on 1-3 (p-i-m-a notation)"
  - "Barre chords available — full or partial"
  - "Harmonics at frets 5, 7, 12"
  - "Can handle up to 4 independent voices simultaneously"
notation: "number-tab" # standard guitar tablature (or standard notation)
```

### Piano

```yaml
id: piano
name: "Piano"
type: keyboard
range:
  lowest: "a,,," # A0
  highest: "c''''''" # C8
staves: 2 # treble + bass (grand staff)
constraints:
  - "Maximum stretch: ~10th (large hands) or octave (average)"
  - "Each hand can play up to 5 simultaneous notes"
  - "Sustain pedal extends note duration beyond finger release"
  - "Wide dynamic range — can mark pp to ff"
  - "No pitch bending, vibrato, or microtones"
  - "Hands are semi-independent — voice crossing between staves is idiomatic"
notation: "standard" # grand staff, treble + bass clef
```

### Voice (SATB)

```yaml
id: voice-soprano
name: "Soprano Voice"
type: voice
range: { lowest: "c'", highest: "a''" } # C4–A5
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
range: { lowest: "f", highest: "d''" } # F3–D5
clef: treble
---
id: voice-tenor
name: "Tenor Voice"
range: { lowest: "c", highest: "a'" } # C3–A4
clef: "treble_8"
---
id: voice-bass
name: "Bass Voice"
range: { lowest: "e,", highest: "e'" } # E2–E4
clef: bass
```

Voice profiles enable:

- **Song arrangements** — melody line with lute/guitar accompaniment
- **Continuo realization** — soprano line + figured bass → full texture
- **Transcription** — vocal part extracted from a choral work for study
- **Intabulation** — arranging vocal polyphony for solo lute (core Renaissance repertoire)

Additional profiles can be added: archlute, mandora, vihuela, 7-course Dowland-era lute, etc.

---

## Arrangement Engine — How the Musicological Engine Arranges

### Input Types

Vellum accepts multiple source formats and normalizes them into versioned musical state before arrangement. Model memory is a disclosed best-effort source, never an equivalent substitute for an uploaded score.

1. **PDF or image** — uploaded Source Artifact → confidence-bearing Score Transcription → review only for Critical Uncertainty
2. **MusicXML, restricted LilyPond, MEI, or ABC** — parsed into a versioned Normalized Score with source diagnostics
3. **Lead sheet** — melody and chord symbols become simultaneous Preservation Targets
4. **Existing tablature** — pitches, course choices, rhythm, and notation semantics are preserved where represented
5. **Figured bass** — bass and figures become a Continuo Foundation; upper voices are generated under a Realization Profile
6. **Natural language or model memory** — disclosed best effort with explicit source uncertainty

### Continuo Output

A result is a complete Continuo Realization only if its Arrangement Score actually
sounds the authoritative Continuo Foundation. If the plucked target cannot do so,
Vellum offers either of two honest outputs:

- retain the Continuo Foundation on a separate bass staff or instrument and treat
  the plucked part as the upper realization; or
- create a clearly labeled **Continuo Reduction** for the solo target.

A Continuo Reduction retains the entire foundation in source lineage and maps
every unsounded bass event in its Preservation Audit. Systematic bass omission
under Faithful Reduction requires a Policy Exception and may amount to Policy
Drift; harmonic implication or a matching chord root does not count as sounding
the authoritative bass. Engraving and Audio Preview must not add an absent bass
while representing the target part as a complete realization.

### PDF and Image Recognition

PDF/image recognition uses a backend-neutral OMR adapter. Audiveris is the first
supported implementation, but neither Audiveris nor MusicXML defines Vellum's
canonical score model. Every recognition attempt creates a versioned **OMR Run**
that retains:

- the immutable PDF or image Source Artifact;
- backend identity, version, configuration, and invocation;
- logs, diagnostics, and confidence/uncertainty evidence where available;
- mappings from recognized pages and regions back to the Source Artifact;
- backend-native project and intermediate data, including Audiveris `.omr`; and
- interchange exports such as MusicXML.

MusicXML is an input to normalization, not the complete recognition record. A
different backend, upgraded backend, or changed configuration creates a new OMR
Run and Score Transcription version, leaving earlier evidence reproducible.

### Score-Anchored Review

When recognition produces a Critical Uncertainty, Vellum opens the exact source
page and region beside the corresponding editable notation. The review shows the
recognized value, ranked alternatives, confidence or other backend evidence, and
the musical consequence of the uncertainty—for example, whether it changes a
Principal Voice event, figure, rhythm, key signature, or repeat structure.

Accepting a suggestion or direct notation edit creates a new Score Transcription
version and preserves the earlier transcription and immutable Source Artifact.
The source-region mapping remains attached to the corrected musical object for
later audit. Chat can explain the issue and can accept textual corrections, but a
user should not have to describe a visible notation error in prose when it can be
corrected directly against the facsimile.

### Arrangement Process

The Musicological Engine follows this process:

```
1. INGEST AND VERSION
   - Preserve the Source Artifact and create or import a Score Transcription
   - Normalize musical time, voices, notation, figures, lyrics, and provenance

2. ANALYZE AND SCOPE
   - Produce score-anchored Analysis Claims for form, harmony, Texture,
     Contrapuntal Techniques, phrases, cadences, and Preservation Targets
   - Select applicable Knowledge Packs, Realization Profiles, and Validation Profiles

3. PLAN
   - Resolve Preservation Policy, target instrument, Notation Layouts, Bass Tuning,
     Transposition Plan, sectional texture, and allowed transformations

4. GENERATE CANDIDATES
   - Explore musically consequential alternatives in key, register, texture,
     voicing, course assignment, articulation, and ornamentation

5. REJECT HARD FAILURES
   - Run Preservation Audits, figured-bass checks, instrument constraints,
     playability, and hard contextual Validation Findings

6. RANK AND COMPARE
   - Score surviving candidates by historical profile, idiom, voice leading,
     playability, notation clarity, and soft preferences
   - Use model judgment to compare close alternatives with inspectable rationale

7. SELECT AND VERSION
   - Promote the selected candidate to a versioned Arrangement Score
   - Retain alternatives for audition and branching

8. ENGRAVE AND VERIFY
   - Generate requested Notation Layouts and Deliverables
   - Compile, inspect, and regenerate until notation and rendering checks pass
```

### Transposition

Faithful Reduction permits a uniform whole-work Transposition Plan. Vellum may
choose the best playable key automatically when it preserves every protected
interval, rhythm, contour, harmonic function, formal relationship, and cadence.
Before generation it announces the source key, target key, interval, affected
parts, and playability rationale. The Preservation Audit verifies the exact
source-to-target mapping.

Vellum asks before transposing when absolute pitch or key depends on a fixed voice
or instrument, vocal range, source-specific scordatura, a requested edition or
recording, or another detected ensemble constraint. In those cases the
Transposition Plan remains unresolved until the user chooses or changes the
constraint.

Faithful Reduction does not permit independently transposing an isolated passage
merely to make it fit. Arrangement Search must first exhaust viable octave
placement, revoicing, Texture reduction, and accompaniment simplification within
the whole-work Transposition Plan. A passage-level transposition is allowed only
when it is present in the source or the Owner approves a score-anchored Policy
Exception; otherwise the Preservation Audit fails it as a change to the work's
tonal relationships.

A uniform octave relocation of the complete Principal Voice is compatible with
Faithful Reduction when announced and recorded in the Transposition Plan. Local
octave displacement is more dangerous: the Preservation Audit must prove that it
retains pitch-class order, phrase contour, registral emphasis and climax, cadence
approach, rhythmic identity, and the voice's perceptual prominence in the target
Texture. Octave folding that fragments, obscures, or changes the recognizable
melodic shape requires a score-anchored Policy Exception.

### Audio Preview

Every selected Arrangement Score automatically receives a basic synthesized Audio
Preview. Vellum already obtains MIDI from the LilyPond compilation path; the
browser decodes that MIDI and schedules it through a lightweight Web Audio
synthesizer. The initial controls are play/pause, stop, seek/progress, and volume.

Playback is divided into named semantic **Playback Parts** for the Principal Voice,
Continuo Foundation, accompaniment, and any other musically distinct voice or
instrument. Each part has independent mute, solo, and level controls. Parts derive
from canonical sounding events and arrangement roles rather than engraving staves,
so presenting one voice in both standard notation and tablature cannot double its
MIDI notes. Preservation Targets and audit findings link to their Playback Parts,
making it possible to hear protected melody, bass, or accompaniment in isolation.

Playback and score selection support bidirectional **Lineage Navigation**. Clicking
an Arrangement Score event, recognized notation object, source facsimile region,
Analysis Claim, or Preservation Audit finding seeks to the corresponding sounding
time. During playback Vellum highlights all simultaneous Arrangement Score events
and their linked transcription objects, source regions, claims, and audit mappings.

The timeline uses **Playback Occurrences** rather than assuming one timestamp per
written event. Each traversal of a repeat or ending receives its own occurrence
identity while retaining the canonical event lineage. This lets the same written
note highlight correctly on successive passes and prevents seeking or diagnostics
from depending on page coordinates or matching raw MIDI pitches.

By default the timeline follows the complete **Performed Form** derived from
repeats, volta endings, da capo or dal segno instructions, segnos, codas, and
related navigation signs. A **Skip repeats** practice toggle produces a temporary
condensed traversal for faster checking; it does not edit score structure or create
a Performance Interpretation. The chosen traversal and every Playback Occurrence
are recorded reproducibly. A Critical Uncertainty in any form-defining sign blocks
authoritative playback and opens Score-Anchored Review rather than silently
guessing the work's form.

Temporary **Practice State** adds passage looping and playback-speed control. Loop
boundaries are selected on Playback Occurrences so they remain unambiguous within
repeated form. Speed scaling preserves pitch and relative rhythmic proportions.
Practice State is reset independently and never changes tempo markings,
Arrangement Scores, Performance Interpretations, Preservation Audits, exported
MIDI, or any other Deliverable.

The preview is a reproducible projection of the Arrangement Score, not separate
musical state. It must use the score's sounding pitches, durations, tempo, repeats,
transpositions, re-entrant courses, and diapasons, and it must not double notes
merely because the same music appears in both standard notation and tablature.
Alternative Arrangement Candidates are previewed on demand so they can be compared
without eagerly rendering every candidate. The initial neutral synthetic timbre is
for checking notes and musical identity; realistic lute, baroque-guitar, or
classical-guitar sampling is outside the basic preview contract.

Literal score playback is the default. If Vellum later realizes ornaments,
arpeggiation, inequality, articulation, tempo shaping, or rubato, those choices are
stored in a versioned **Performance Interpretation** linked to an exact Arrangement
Score version. Interpretive playback is explicitly labeled and can be toggled
against literal playback. It does not mutate the Arrangement Score, invalidate the
score's notational identity, or silently alter its Preservation Audit.

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

| Feature            | Syntax                                            | Purpose                                         |
| ------------------ | ------------------------------------------------- | ----------------------------------------------- |
| French letters     | `tablatureFormat = #fret-letter-tablature-format` | a=open, b=1st fret, c=2nd, etc.                 |
| Diapasons          | `additionalBassStrings = \stringTuning <...>`     | Bass courses below staff, printed as a, /a, //a |
| Custom fret labels | `fretLabels = #'("a" "b" "c" ...)`                | Override default letter mapping if needed       |
| Rhythm flags       | `\new RhythmicStaff` above `TabStaff`             | Separate rhythm notation above tab              |
| Hidden MIDI staff  | `\new Staff \with { ... transparent ... }`        | Correct MIDI output (see below)                 |

### MIDI Output

LilyPond's MIDI from `TabStaff` with custom tunings works for basic cases but has edge cases with `additionalBassStrings`. The reliable pattern is a **hidden parallel Staff** that shares the same music expression:

- The hidden `Staff` produces correct MIDI with proper pitch mapping
- The visible `TabStaff` handles notation display only (`midiInstrument = ##f` if needed)
- Both reference the same `\music` variable — no duplication

This pattern is built into all LilyPond templates.

**MIDI instrument mapping:** General MIDI has no "baroque lute." Closest: `"acoustic guitar (nylon)"` (program 25). For theorbo continuo, `"acoustic bass"` (program 33) may be more appropriate for the diapason register.

### Ornaments in Tablature

The six standard baroque lute ornaments for v1, using LilyPond builtins:

| Ornament     | French Name    | LilyPond        | Tab Display         | Usage                            |
| ------------ | -------------- | --------------- | ------------------- | -------------------------------- |
| Trill        | tremblement    | `\trill`        | Symbol above letter | Very common, most accented notes |
| Mordent      | martellement   | `\mordent`      | Symbol above letter | Alternation with note below      |
| Appoggiatura | port de voix   | `\appoggiatura` | Small grace note    | Ascending approach note          |
| Slur         | tirade/coulé   | `( )`           | Arc between letters | Hammer-on / pull-off             |
| Staccato     | étouffé        | `\staccato`     | Dot                 | Muted/stopped note               |
| Turn         | double cadence | `\turn`         | Symbol above letter | Upper-lower neighbor figure      |

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
       [uploads MusicXML file]

Agent:
1. analyze(uploaded_musicxml)
   → Key: D major, Time: 3/4
   → Voices: Soprano (D4–E5), Alto (A3–B4), Tenor (D3–A3), Bass (G2–D3)
   → Chord progression: I | V6 | vi | IV | ii | V7 | I ...
   → Identifies Alleluia refrains (repeated descending I–V–vi–IV pattern)

2. LLM reads analysis + baroque-guitar-5 profile:
   "G major gives the melody and alfabeto shapes a better playable register, so
    I'll transpose the complete D-major setting down a fifth to G major.
    theory('scale_chords', {tonic: 'G', scale: 'major'}) confirms
    G, Am, Bm, C, D, Em, F#dim — all available to the voicing search.
    Which stringing? French (full re-entrant), Italian, or mixed?"

3. User picks French

4. Plans arrangement from chordify results:
   - Verses: punteado — melody (soprano) on courses 1-3, bass reduced for courses 4-5
   - Alleluias: rasgueado — strummed chords from the Roman numeral progression

5. For verses: punteado arrangement
   - Melody on courses 1-3 via tabulate()
   - Bass line simplified for re-entrant courses 4-5
   - check_playability() → clean

6. For Alleluia refrains: rasgueado arrangement
   - voicings(chord, "baroque-guitar-5", stringing="french")
   - Strummed chords with rhythm notation

7. lint(arrangement) → checks voice leading in punteado sections
   → "Bar 6, beat 1: parallel fifths between melody and bass"
   → Fixes the voicing, re-runs lint → clean

8. Adds period-appropriate ornaments (mordents on cadences)

9. compile() → French tab preview (punteado sections)
   + alfabeto notation for rasgueado sections

10. "Bars 5-8 had a wide tenor-bass gap — I dropped the alto D
     and doubled the root in the strummed chord instead.
     lint() confirms no voice leading violations in the final version."
```

---

## Quality Criteria

### Primary Golden Arrangement Fixture

The primary end-to-end acceptance fixture is a repository-stored, legally
redistributable public-domain PDF of a four-part setting of _Greensleeves_. The
fixture includes source and license provenance, reviewed Score Transcription data,
and expected musical invariants so recognition drift can be distinguished from an
arrangement regression.

Its primary path must prove:

1. generic PDF upload and immutable Source Artifact storage;
2. a reproducible OMR Run and Score-Anchored Review of any Critical Uncertainty;
3. four-voice normalization, Musicological Analysis, and correct Principal Voice
   identification;
4. Faithful Reduction through structured Arrangement Search to five-course
   baroque guitar with French Stringing and French-Letter Tablature;
5. event-by-event Preservation Audit of the complete Principal Voice, including
   pitch, rhythm, ordering, contour, phrase, and cadence relationships;
6. perceptual prominence of that voice as the recognizable top line while inner
   voices yield to instrument range and playability;
7. successful engraving plus semantic, non-duplicated Audio Preview; and
8. sibling 13-course baroque-lute and classical-guitar Arrangement Scores from the
   same source, each with independent search, constraints, and audit.

The fixture cannot pass merely because LilyPond compiles, a MIDI file exists, or a
model says the tune is recognizable. Tests compare the reviewed Principal Voice
and its protected relationships against the exact selected Arrangement Score.

### Figured-Bass Golden Fixture

The second end-to-end fixture is a short, legally redistributable public-domain
PDF containing an independent soprano and figured bass, including at least one
prepared suspension. Its reviewed transcription identifies every soprano and bass
event, figure, alteration, cadence, and suspension relationship.

The fixture must prove:

1. PDF/OMR recognition keeps the Continuo Foundation distinct from the Principal
   Voice and flags Critical Uncertainty in either layer;
2. analysis selects and discloses an applicable Realization Profile;
3. a capable Target Configuration produces a complete Continuo Realization that
   preserves every authoritative bass event and satisfies the figures;
4. an incapable solo target produces either a separate bass part or a labeled
   Continuo Reduction with every unsounded foundation event mapped;
5. generated upper voices remain distinct from source evidence in lineage and the
   Transformation Report;
6. contextual validation recognizes the documented suspension treatment instead
   of applying blanket dissonance or parallel-motion rules; and
7. Audio Preview exposes separate Principal Voice, Continuo Foundation, and
   generated-realization Playback Parts.

### Imitative-Counterpoint Golden Fixture

The third fixture is a short, legally redistributable public-domain three-voice
imitative passage whose identity depends on ordered entries rather than one
permanent Principal Voice. Its reviewed data identifies voice events, entry order,
subject interval-rhythm shapes, cadential goals, and required voice continuities.

The fixture must prove:

1. Musicological Analysis classifies imitative-polyphonic Texture separately from
   its Contrapuntal Techniques and selects an appropriate Validation Profile;
2. entry order, subject shapes, cadential goals, and voice continuities become
   explicit Preservation Targets;
3. Arrangement Search intabulates the passage for six-course Renaissance lute in
   French tablature, redistributing notes across playable courses and registers
   without erasing or reordering the imitation;
4. validation does not substitute generic Species Counterpoint or blanket
   parallel-motion rules for the selected profile;
5. the Preservation Audit checks every protected entry and relationship rather
   than only pitch coverage or the highest source voice; and
6. Audio Preview and Lineage Navigation can isolate each source voice and its
   interleaved arrangement descendants on the single tablature staff.

### Baroque-Lute Diapason Engraving Fixture

A dedicated Golden Engraving Fixture must prove that open course 10 on the default
13-course D-minor baroque lute renders as `///a` below the French tablature staff
and sounds D2. The accepted sign is prefix-slash `///a`, not `a///`.

The test checks all of the following independently:

1. the structured event selects open course 10;
2. generated LilyPond retains the correct course and `additionalBassStrings`
   semantics;
3. rendered output contains the approved `///a` glyph in the correct below-staff
   position, using a semantic assertion or focused visual regression rather than a
   non-empty-SVG check;
4. MIDI and Audio Preview contain D2 exactly once; and
5. changing course 10 through a Bass Tuning changes its sounding pitch while its
   course-identity sign remains `///a`.

A companion fixture verifies the complete default sign sequence `a`, `/a`, `//a`,
`///a`, `4`, `/4`, and `//4` for courses 7–13.

### Provider Connection Acceptance

Provider Connection has two independent acceptance layers.

The automated **Provider Contract Fixture** uses a deterministic fake provider to
exercise connect initiation, callback validation, CSRF/state mismatch, successful
authorization, expiry, refresh, atomic credential writes, single-flight refresh
concurrency, interruption and retry of Model Actions, reconnect, logout, and all
visible connection states. It requires no real account, never reads Pi or Codex
credential files, and asserts that tokens cannot appear in logs, errors, test
snapshots, workspace exports, or browser-visible state.

An opt-in real ChatGPT subscription smoke test verifies the current provider OAuth
flow, connected status, one minimal model request, local disconnect, and reconnect.
It is never a CI requirement and never records credentials, authorization codes,
callback parameters, or model content beyond a redacted success result. Reporting
distinguishes provider-contract drift from deterministic Vellum state-machine
failures.

An arrangement is "good" if:

1. **Faithful to its policy** — every Preservation Target passes a machine-readable Preservation Audit; necessary deviations have explicit Policy Exceptions
2. **Playable** — no impossible stretches, fingerings are natural (`check_playability` passes)
3. **Theoretically sound** — counterpoint, voice leading, figures, and harmonic claims satisfy the applicable analysis and Realization Profiles
4. **Musical** — voice leading is coherent, the Continuo Foundation and bass make structural sense, and the intended Texture remains perceptible
5. **Idiomatic** — sounds like it belongs on the instrument and within the selected historical scope, not like a mechanical transposition
6. **Complete** — no required material is silently missing
7. **Readable** — tablature or standard notation is clear, rhythmic notation is correct, and page layout is clean

The engine cannot complete a Faithful Reduction with unexplained compromises. A necessary dropped note, altered rhythm, or changed relationship must become a visible, Owner-approved Policy Exception.

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
│   │                          #   diapasons, fretboard, analyze, lint, theory)
│   ├── theory.ts              # tonal.js wrapper — browser-side music theory
│   │                          #   calculations for the theory tool
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
│       ├── theory.ts          # POST /api/analyze, /api/lint, /api/chordify,
│       │                      #   /api/realize — calls theory.py subprocess
│       ├── theory.py          # Python CLI script wrapping music21:
│       │                      #   python3 theory.py analyze < input.xml
│       │                      #   python3 theory.py lint < input.ly
│       │                      #   python3 theory.py chordify < input.xml
│       │                      #   Returns JSON to stdout
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

## Local-First Runtime and Optional NixOS Deployment

Vellum runs primarily on the Owner's machine, where localhost can host the UI, musical services, durable state, and provider callback. Its `flake.nix` also exports a package and NixOS module for reproducible installation or optional private remote access. A servoid configuration remains possible:

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
- **music21 dependency** — `pkgs.python3.withPackages (ps: [ ps.music21 ])` pinned via Nix. Called as subprocess by the theory API endpoints. Same deployment pattern as LilyPond — no separate Python service, no virtualenv, just a Nix-managed Python with music21 available
- **Traefik integration** — reverse proxy with mTLS via step-ca
- **Secrets management** — API keys injected at runtime, never in the repo
- **Data directory** — `/var/lib/vellum/arrangements/` for saved arrangements

The Nix build:

1. `buildNpmPackage` builds the Express server + Vite browser bundle
2. LilyPond and Python+music21 are runtime dependencies, not build dependencies
3. The `xlsx` CDN tarball URL in pi-web-ui's dependency tree may need lockfile patching for `fetchNpmDeps` — test early

This remote configuration is optional and must not become the credential or ownership boundary for the local-first product.

---

## v1 Scope

### Infrastructure

- [ ] Set up pi-mono packages (`pi-agent-core`, `pi-web-ui`, `pi-ai`)
- [ ] Express server with API endpoints (`/api/stream`, `/api/compile`, `/api/analyze`, `/api/lint`, `/api/chordify`, `/api/instruments`, `/api/arrangements`, `/api/templates`)
- [ ] `streamProxy` integration for LLM API key security
- [ ] Vite build pipeline for browser bundle (including tonal.js)
- [ ] Install LilyPond via Nix (2.24.x)
- [ ] Install Python 3 + music21 via Nix (`python3Packages.music21`)
- [ ] Create `flake.nix` with package + NixOS module
- [ ] Package and verify the local-first owner runtime
- [ ] Keep servoid deployment as an optional private-access configuration

### Tools

- [ ] Define all `AgentTool<T>` objects with TypeBox schemas: `compile`, `tabulate`, `voicings`, `check_playability`, `transpose`, `diapasons`, `fretboard`, `analyze`, `lint`, `theory`
- [ ] Implement server-side `POST /api/compile` with LilyPond subprocess and structured error parsing
- [ ] Implement server-side `POST /api/analyze` — music21 subprocess: MusicXML → key, Roman numerals, voice ranges, time signature
- [ ] Implement server-side `POST /api/lint` — music21 subprocess: voice leading rule checking (parallel 5ths/8ves, voice crossing, spacing, unresolved leading tones)
- [ ] Implement server-side `POST /api/chordify` — music21 subprocess: multi-voice → chord-per-beat reduction
- [ ] Implement `server/theory.py` — Python CLI wrapping music21 (analyze, lint, chordify subcommands, JSON output)
- [ ] Implement browser-side `theory` tool — tonal.js wrapper for instant interval/chord/scale lookups
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

**Recommendation:** John Dowland's "Flow My Tears" (from _The Second Booke of Songs or Ayres_, 1600) as the primary v1 test piece.

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

- **Tune is from 1623** (_Geistliche Kirchengesäng_, Cologne) — literally contemporaneous with the baroque guitar's golden age
- **Text by St. Francis of Assisi** (Canticle of the Sun, ~1225) — public domain, significant in Catholic tradition
- **Tests the hardest conversion pipeline** — SATB/organ → 5-course baroque guitar requires harmonic reduction, voice thinning, key transposition, and style decisions (rasgueado vs. punteado)
- **Exercises the full music21 pipeline** — MusicXML from hymnary.org is parsed directly by music21's `converter.parse()`, voices extracted automatically via `score.parts[]`, and `chordify()` produces the harmonic analysis the LLM needs for arrangement decisions
- **The Alleluia refrains** — repeated descending figures that naturally call for rasgueado (strummed) treatment, while verses suit punteado (plucked) melody + bass
- **Transposition test** — hymnals usually print this in D or Eb major; baroque guitar wants A minor or G major for idiomatic open-string usage with re-entrant tuning
- **Re-entrant tuning payoff** — courses 4-5 sounding an octave higher means strummed chords ring with natural brightness that organ can't replicate
- **Real liturgical use** — the output is something you could actually play at Mass or at home

**The conversion workflow this validates:**

```
Input:  SATB hymnal setting (MusicXML from hymnary.org)
Step 1: analyze(musicxml) → key, Roman numeral progression, voice ranges
Step 2: LLM + theory() decides target key (D major → A minor or G major)
Step 3: LLM plans arrangement from chordify results (verses=punteado, Alleluias=rasgueado)
Step 4: Generate arrangement using tabulate() + voicings() + check_playability()
Step 5: lint(arrangement) → fix voice leading errors → re-lint until clean
Step 6: compile() → French letter tab or number tab PDF + optional voice line
```

**Test scenarios:**

1. Upload SATB hymnal setting (MusicXML) → `analyze()` → `chordify()` → produce baroque guitar arrangement
2. Generate both punteado (plucked) and rasgueado (strummed) sections within one piece
3. Test alfabeto chord notation for strummed passages
4. `lint()` the final arrangement — verify zero voice leading violations
5. Convert the same hymn to classical guitar (compare voicing decisions)
6. Produce a voice + guitar version (melody line + guitar accompaniment)

## v2 Scope

- [ ] OSMD/VexFlow interactive score rendering for standard notation (guitar, piano, voice — **not** tablature, which stays LilyPond SVG)
- [ ] MIDI playback via Web Audio API (HTML artifact with embedded player)
- [ ] Bar-click interaction (click a bar → agent knows which bar to revoice)
- [ ] MusicXML export (via MuseScore CLI on server, or custom writer)
- [ ] Fretboard visualization with position overlay (interactive, beyond static SVG)
- [ ] Durable Arrangement Workspaces with sources, analysis, corrections, plans, outputs, and provenance
- [ ] Session branching for "try it this way" workflows
- [ ] Figured bass realization workflow (`POST /api/realize` via music21's `figuredBass.realizer` — endpoint defined in v1, implementation deferred)
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

The core realization is that the agent shell must not become the sole repository of musical intelligence. Vellum needs:

1. A conversational interface with visual feedback
2. Canonical source, analysis, preservation, and arrangement representations
3. Deterministic analyzers and curated historical profiles
4. Model-assisted interpretation and creative planning with inspectable evidence
5. Constraint checks for preservation, figured bass, counterpoint, playability, and notation
6. A way to run LilyPond server-side
7. A clean client-server split that keeps credentials secure

Pi-mono provides the agent loop, chat components, and tool framework. Vellum provides the canonical musical representations, Musicological Engine, provider connection, and score workbench. Nix supplies reproducible musical dependencies for the local runtime and optional NixOS packaging.

**Why pi-mono over building from scratch:**

- Pi already provides the agent loop, tool framework, web UI, artifact display, session storage, and LLM proxy
- Building these from scratch would replicate what pi does, but worse
- Pi's `AgentTool<T>` pattern with TypeBox schemas maps perfectly to Vellum's domain tools
- `registerToolRenderer()` enables inline visual feedback (SVG preview, fretboard diagrams) in the chat stream
- The `ArtifactsPanel` handles the tablature workbench with no custom code (SVG is a built-in artifact type)
- `streamProxy` solves the API key security problem cleanly

### Complement: Python + music21 (Server-Side Theory Engine)

**Role:** Server-side music theory analysis engine, deployed alongside LilyPond as a subprocess dependency.

**Why music21 and not just tonal.js:**

- **MusicXML parsing** — music21 has native `converter.parse()` for full score ingestion. tonal.js has no file I/O at all. The hymnal conversion workflow requires reading MusicXML files with multiple SATB voices — music21 does this trivially, tonal.js can't start.
- **`chordify()`** — reduces any multi-voice score to a chord-per-beat analysis. This is THE critical operation for hymnal → guitar conversion. tonal.js can detect a chord from a set of notes, but can't extract those notes from a score.
- **Voice leading analysis** — `VoiceLeadingQuartet` with methods for parallel fifths, parallel octaves, contrary motion, voice crossing, spacing. tonal.js's `@tonaljs/voice-leading` is about jazz voicing smoothness, not counterpoint rule checking.
- **Key detection** — Krumhansl-Schmuckler algorithm: `score.analyze('key')`. Signal processing on pitch class distributions. tonal.js can tell you what chords fit a key but can't determine a key from a passage.
- **Roman numeral analysis** — `roman.romanNumeralFromChord(chord, key)` with full inversion awareness. tonal.js parses Roman numeral _symbols_ but can't derive them from music.
- **Figured bass realization** (v2) — `figuredBass.realizer` engine. tonal.js has nothing comparable.

**Why tonal.js complements music21:**

- Runs in the browser — instant results, no server round-trip for simple lookups
- Covers interval math, chord spelling, scale membership, enharmonic equivalents
- The LLM uses `theory()` mid-conversation for quick calculations while `analyze()` and `lint()` handle the heavy analysis

**Deployment:** Same pattern as LilyPond — subprocess call, not a separate service. `python3 theory.py analyze < input.xml` → JSON to stdout. No migration debt; the API surface (JSON in, JSON out) is implementation-agnostic. If music21 were ever replaced, only `server/theory.py` changes.

**Role in the hybrid engine:** Music21 contributes deterministic analysis but is not the whole Musicological Engine. Its results feed structured Analysis Claims alongside curated historical profiles, model-assisted interpretation, user corrections, and downstream constraint verification. The model should not redo interval arithmetic or chord identification when a library can establish those facts reliably.

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
- [music21](https://web.mit.edu/music21/) — MIT's computational musicology toolkit (Python). MusicXML parsing, harmonic analysis, voice leading, figured bass realization
- [tonal.js](https://github.com/tonaljs/tonal) — TypeScript music theory library. Intervals, chords, scales, keys, voicings, Roman numerals
- [LilyPond Tablature docs](https://lilypond.org/doc/v2.24/Documentation/notation/common-notation-for-fretted-strings) — fretted string notation
- [LilyPond Lute tablature](https://lilypond.org/doc/v2.24/Documentation/notation/lute-tablatures) — French tab, diapasons, `fret-letter-tablature-format`
- [Fronimo](https://sites.google.com/view/fronimo/home) — reference for historical tablature rendering
- [MEI Tablature encoding](https://music-encoding.org/guidelines/v5/content/tablature.html) — future interchange format
- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) — browser MusicXML rendering (standard notation only, not tablature)
- Nigel North, _Continuo Playing on the Lute, Archlute and Theorbo_ — baroque lute tuning reference
- Robert Dowland, _Varietie of Lute Lessons_ (1610) — ornament tables
- James Tyler & Paul Sparks, _The Guitar and its Music_ (2002) — baroque guitar stringing evidence
- Gaspar Sanz, _Instrucción de música sobre la guitarra española_ (1674) — stringing taxonomy
