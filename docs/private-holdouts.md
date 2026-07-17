# Owner-local musical holdouts

Vellum's private holdout set stays outside the repository. It is intentionally a plain local
manifest plus an append-only attempt log, not a Vault or qualification system.

1. Complete a reviewed arrangement in Vellum and compile its notation and playback deliverables.
2. Create `~/.vellum/holdouts/manifest.json` with an opaque case ID and the saved workspace and
   arrangement IDs. Keep reviewed event truth in this local file only.
3. Run `npm run proof:holdout` from the repository.

Example local manifest:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "id": "holdout.01234567",
      "workspaceId": "workspace.REPLACE_WITH_LOCAL_ID",
      "arrangementScoreId": "arrangement.REPLACE_WITH_LOCAL_ID",
      "truth": {
        "principalSourceEventIds": ["event.REVIEWED_SEQUENCE"],
        "cadenceSourceEventIds": ["event.REVIEWED_CADENCE"],
        "subordinateSourceEventIds": ["event.REVIEWED_SUBORDINATE_VOICE"]
      }
    }
  ]
}
```

The runner refuses manifests inside the repository. It reads the saved arrangement, reports
source fidelity, phrase/cadence, subordinate continuity, mechanics, idiom, notation, and playback
separately, then appends only the opaque case ID, statuses, and generic finding codes to
`~/.vellum/holdouts/attempts.ndjson`. It never writes workspace IDs, arrangement IDs, source
identity, or reviewed event truth to that log. A hard failure makes the case fail; passing
dimensions cannot average it away. Missing evidence is `incomplete`, while an unreadable case is
`blocked`.

The public counterpart is `npm run proof:musical`. Old 100th is its primary three-target source;
Greensleeves remains a secondary regression alongside explicit continuo and imitative fixtures.
