# MEI Editions execution plan

Status: active

Current tracer: T05 — Owner page-9 acceptance.

## Outcome

Turn page 9 of de Visée's 1686 _Pièces pour la guittare_ into a reviewed, interactive, playable
MEI edition, then use one accepted selection as bounded repertoire evidence.

## Queue

|  ID | Tracer                                              | Type | Blocked by | Result                                                                 |
| --: | --------------------------------------------------- | ---- | ---------- | ---------------------------------------------------------------------- |
|  01 | Secure pinned Verovio edition vertical              | AFK  | None       | One representative MEI renders, selects, plays, and exports safely     |
|  02 | De Visée diplomatic transcription and corrections   | AFK  | 01         | Page 9 persists as facsimile-linked MEI with atomic Correction Batches |
|  03 | Interpretation acceptance and synchronized playback | AFK  | 02         | Separate approvals and provisional/accepted playback remain aligned    |
|  04 | Passage prompting and model-assisted edits          | AFK  | 03         | Versioned selections drive inspectable prompts and reviewed edits      |
|  05 | Owner page-9 acceptance                             | HITL | 04         | Owner accepts the whole-page transcription and one interpretation      |
|  06 | First accepted Attested Realization                 | AFK  | 05         | One accepted selection becomes bounded candidate-only evidence         |

## Execution rules

- Follow dependency order and finish each tracer with its applicable gates, one commit, and one
  push before starting its dependent.
- Build only the generic behavior exercised by the tracer. Do not build a general scholarly
  editor, library crawler, recognition model, or knowledge-publication system.
- The Owner-local de Visée scan is an execution input, not a tracked fixture. Automated tests use
  rights-approved or project-authored substitutes.
- T05 is the sole planned HITL gate. T06 resumes automatically from its accepted version IDs.
- A failed renderer, model, or tool call is a diagnosis problem, not permission to bypass
  canonical versions, security, or acceptance.

## Stop conditions

Pause only when the exact source bytes require a rights decision, the Owner must decide among
musically distinct viable interpretations, or T05 is ready. Ordinary implementation and test
failures remain autonomous work.
