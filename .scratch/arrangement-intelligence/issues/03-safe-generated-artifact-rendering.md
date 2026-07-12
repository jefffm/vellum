# Safe generated-artifact rendering

Status: ready-for-agent

Type: AFK

User stories: U1, U5

## What to build

Establish one sanitization and content-security boundary for generated notation and Evaluation Report artifacts before they enter the browser.

## Acceptance criteria

- [ ] Compiled SVG and report fragments are sanitized or isolated before display.
- [ ] Safe musical annotations and selection identities survive the boundary.
- [ ] Hostile script, event-handler, link, and external-resource fixtures cannot execute.
- [ ] Workbench and evaluation reports use the same tested policy.

## Blocked by

- 02
