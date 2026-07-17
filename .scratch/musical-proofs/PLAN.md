# Musical Proofs execution plan

Status: active

## Outcome

Deliver one real, understandable PDF-to-arrangement workflow whose outputs are recognizably and
idiomatically musical on all three priority instruments, can be revised and versioned, and can
be tested without a certification platform.

## Queue

|  ID | Tracer                                            | Type | Blocked by | Result                                                                                    |
| --: | ------------------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------------------------- |
|  01 | Non-Greensleeves three-target baseline            | AFK  | None       | One public source exposes current musical failures through the real product path          |
|  02 | Shared phrase and voice obligations               | AFK  | 01         | Principal and subordinate material survive phrase-level planning end to end               |
|  03 | Five-course baroque-guitar idiom proof            | AFK  | 02         | Punteado, rasgueado, alfabeto, and mixed style constrain generation correctly             |
|  04 | Thirteen-course baroque-lute idiom proof          | AFK  | 02         | Calibrated reach, right hand, diapasons, tablature, and playback agree                    |
|  05 | Six-string classical-guitar two-voice proof       | AFK  | 02         | Principal Voice and coherent bass form a playable independent-voice reduction             |
|  06 | Real PDF to three target outputs                  | AFK  | 03, 04, 05 | Guided Start completes from Audiveris evidence to three saved arrangements                |
|  07 | Interactive revision and score-following playback | AFK  | 02         | Selection, prompting, manual batch edits, versions, and playback marker work together     |
|  08 | Incremental source-backed knowledge loop          | AFK  | 03, 04, 05 | A newly reviewed cited idiom changes one affected compiler consequence without retraining |
|  09 | Musical regression and holdout harness            | AFK  | 06, 07, 08 | Small public corpus and private local holdouts grade separate musical dimensions honestly |
|  10 | Owner three-target playtest                       | HITL | 09         | Owner records concrete playability, idiom, readability, and usefulness findings           |
|  11 | Playtest remediation and milestone closure        | AFK  | 10         | Findings become regressions, repairs pass, and the real workflow is demonstrated again    |

## Execution rules

- Work in dependency order. Tracers 03, 04, and 05 are logically independent after 02, but
  shared local services and musical toolchains should be serialized.
- Complete the narrow observable behavior in each issue; do not implement every adjacent domain
  abstraction.
- Run focused tests while iterating and the applicable gates from `AGENTS.md` before commit.
- Use one implementation commit and one push per tracer. Update the issue checklist in that same
  commit; no receipt commit follows it.
- If a source, target, or test reveals a concrete missing abstraction, add it to the current
  tracer when small or append a new product-facing tracer. Do not create governance work as a
  proxy for the product fix.
- T10 is the only planned HITL boundary. T11 resumes autonomously from the recorded findings.

## Stop conditions

Pause for the Owner only when:

- private source or holdout bytes require an explicit rights decision;
- a real instrument convention cannot be resolved from available sources without choosing a
  historical claim;
- the desired musical transformation conflicts with the selected Preservation Policy; or
- T10 is ready for physical playtest.

Tool failure, a failing test, or a difficult search problem is not itself a reason to stop.
