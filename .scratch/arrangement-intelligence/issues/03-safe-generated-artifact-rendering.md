# Safe generated-artifact rendering

Status: complete

Type: AFK

User stories: U1, U5

## What to build

Establish one producer-and-consumer trust boundary for generated notation and Evaluation Report artifacts: confine the LilyPond/Guile producer, then sanitize or isolate every artifact before it enters the browser.

## Acceptance criteria

- [x] Compiled SVG and report fragments are sanitized or isolated before display.
- [x] Safe musical annotations and selection identities survive the boundary.
- [x] Hostile script, event-handler, link, and external-resource fixtures cannot execute.
- [x] Workbench and evaluation reports use the same tested policy.
- [x] Externally influenced LilyPond executes only in a pinned, disposable, no-network, resource-bounded container with no inherited secrets or writable host path.
- [x] Compiler input, process, output count, output bytes, and duration are bounded; cleanup is deterministic and the application fails closed when Podman or the pinned image is unavailable.
- [x] Adversarial tests prove host sentinels and environment secrets remain inaccessible while ordinary instrument includes and engraving still compile.

## Verification

See `../evidence/T03/verification.json`.

## Blocked by

- 02
