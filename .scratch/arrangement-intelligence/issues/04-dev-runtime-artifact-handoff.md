# Coordinated development runtime and completed-artifact handoff

Status: ready-for-agent

Type: AFK

User stories: U1, U5

## What to build

Provide one coordinated development lifecycle and prove that a completed Guided Start run opens its exact selected Deliverables automatically.

## Acceptance criteria

- [ ] One command watches and restarts the API, starts the browser client after readiness, and shuts both down cleanly.
- [ ] A stale compiled API cannot silently serve a newer client schema.
- [ ] Completed multi-target work opens the selected artifact rather than an empty panel.
- [ ] A real-browser test covers startup, completion, artifact display, and reload.

## Blocked by

- 02
- 03
