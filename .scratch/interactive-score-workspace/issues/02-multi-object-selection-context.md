# Multi-object Selection Context for chat

Status: in-progress

Type: AFK

## What to build

Extend notation selection from one Arrangement Event to an ordered Selection Context spanning multiple events, measures, voices, or roles. The workbench must present the selection and allow Ask Vellum to seed chat with exact object identities, musical facts, source lineage, target configuration, Preservation Policy, and relevant findings while keeping the human-facing prompt concise.

## Acceptance criteria

- [ ] Shift-click and drag/range interaction can form and revise an ordered multi-event selection.
- [ ] Selected notation is visibly distinct from playback highlighting.
- [ ] Selection Context includes exact Arrangement Score version and stable object IDs plus concise musical summaries.
- [ ] Ask Vellum injects structured context into the next model interaction without requiring the user to transcribe note names.
- [ ] Clearing selection removes it from subsequent prompts.
- [ ] A test selects the Greensleeves opening phrase and verifies that Principal Voice identity and all chosen events reach the prompt context.

## Blocked by

- Tracer 01.
