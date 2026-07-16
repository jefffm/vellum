import type { NormalizedScore, NotationIssue, Rational, ScoreEvent } from "./music-domain.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";

export class UnsupportedRhythmicNotationError extends Error {
  readonly issues: NotationIssue[];

  constructor(issues: NotationIssue[]) {
    super(
      `Arrangement is blocked by unsupported source notation: ${issues
        .map((issue) => `${issue.code} in ${issue.measureIds.join(", ")}`)
        .join("; ")}`
    );
    this.name = "UnsupportedRhythmicNotationError";
    this.issues = issues;
  }
}

export function assertRhythmicSourceSupported(score: NormalizedScore): void {
  assertAuthorityPathRuntime("authority.validator.preservation-editorial", "production");
  const blocking = (score.notationIssues ?? []).filter((issue) => issue.severity === "error");
  if (blocking.length) throw new UnsupportedRhythmicNotationError(blocking);
  validateTupletGroups(score.events);
}

export function validateTupletGroups(events: ScoreEvent[]): void {
  assertAuthorityPathRuntime("authority.validator.preservation-editorial", "production");
  const active = new Map<string, { actual: number; normal: number; measureId: string }>();
  for (const event of events.slice().sort(compareEvents)) {
    const tuplet = event.rhythmicNotation?.tuplet;
    if (!tuplet) continue;
    const begins = tuplet.boundary === "start" || tuplet.boundary === "start_stop";
    const ends = tuplet.boundary === "stop" || tuplet.boundary === "start_stop";
    if (begins) {
      if (active.has(tuplet.groupId)) {
        throw scopedIssue("nested_or_duplicate_tuplet_start", event, tuplet.groupId);
      }
      active.set(tuplet.groupId, {
        actual: tuplet.actualNotes,
        normal: tuplet.normalNotes,
        measureId: event.measureId,
      });
    }
    const group = active.get(tuplet.groupId);
    if (!group) throw scopedIssue("tuplet_without_start", event, tuplet.groupId);
    if (group.actual !== tuplet.actualNotes || group.normal !== tuplet.normalNotes) {
      throw scopedIssue("inconsistent_tuplet_ratio", event, tuplet.groupId);
    }
    if (ends) active.delete(tuplet.groupId);
  }
  if (active.size) {
    const [groupId, group] = active.entries().next().value!;
    throw new Error(`Unclosed tuplet ${groupId} beginning in ${group.measureId}`);
  }
}

function scopedIssue(code: string, event: ScoreEvent, groupId: string): Error {
  return new Error(`${code}: ${groupId} at ${event.measureId}/${event.id}`);
}

function compareEvents(left: ScoreEvent, right: ScoreEvent): number {
  const measure = left.measureId.localeCompare(right.measureId, undefined, { numeric: true });
  return measure || compareRational(left.onset, right.onset) || left.id.localeCompare(right.id);
}

function compareRational(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}
