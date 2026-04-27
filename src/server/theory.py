#!/usr/bin/env python3
"""Music21-backed theory helper for Vellum.

Subcommands read MusicXML from stdin and write JSON to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from itertools import combinations
from typing import Any, Iterable

try:
    from music21 import chord, converter, interval, key, meter, note, roman, stream
except Exception as exc:  # pragma: no cover - exercised when music21 is unavailable
    print(json.dumps({"error": f"music21 is required: {exc}"}), file=sys.stderr)
    sys.exit(2)


@dataclass(frozen=True)
class TimedPitch:
    pitch: Any
    bar: int
    beat: float
    voice: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Vellum music21 theory engine")
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("chordify", help="Reduce MusicXML to chord-per-beat sonorities")
    subcommands.add_parser("analyze", help="Analyze key, voice ranges, and Roman numerals")
    subcommands.add_parser("lint", help="Check basic voice-leading rules")

    args = parser.parse_args()

    try:
        score = parse_stdin_score()
        if args.command == "chordify":
            print_json(chordify(score))
        elif args.command == "analyze":
            print_json(analyze(score))
        elif args.command == "lint":
            print_json(lint(score))
        else:  # pragma: no cover - argparse prevents this
            raise ValueError(f"Unknown command: {args.command}")
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


def parse_stdin_score() -> stream.Score:
    source = sys.stdin.read()
    if not source.strip():
        raise ValueError("No MusicXML input on stdin")
    parsed = converter.parseData(source)
    if not isinstance(parsed, stream.Score):
        parsed = parsed.makeNotation(inPlace=False)
    return parsed


def chordify(score: stream.Score) -> dict[str, Any]:
    return {"chords": [chord_summary(ch) for ch in iter_chords(score)]}


def analyze(score: stream.Score) -> dict[str, Any]:
    analyzed_key = score.analyze("key")
    return {
        "key": format_key(analyzed_key),
        "confidence": key_confidence(analyzed_key),
        "timeSignature": first_time_signature(score),
        "voices": voice_ranges(score),
        "chords": [roman_summary(ch, analyzed_key) for ch in iter_chords(score)],
    }


def lint(score: stream.Score) -> dict[str, Any]:
    voices = extract_voice_lines(score)
    analyzed_key = safe_analyze_key(score)
    violations: list[dict[str, Any]] = []

    for upper_index, lower_index in combinations(range(len(voices)), 2):
        upper = voices[upper_index]
        lower = voices[lower_index]
        pair_count = min(len(upper), len(lower))

        for idx in range(pair_count):
            up = upper[idx]
            lo = lower[idx]
            if lo.pitch.ps > up.pitch.ps:
                violations.append(violation(up, "voice_crossing", f"{lo.voice} crosses above {up.voice}", [up.voice, lo.voice]))

            if upper_index < len(voices) - 2 and lower_index == upper_index + 1:
                semitones = abs(up.pitch.ps - lo.pitch.ps)
                if semitones > 12:
                    violations.append(
                        violation(up, "spacing", f"Spacing between {up.voice} and {lo.voice} exceeds an octave", [up.voice, lo.voice])
                    )

        for idx in range(pair_count - 1):
            start_upper, end_upper = upper[idx], upper[idx + 1]
            start_lower, end_lower = lower[idx], lower[idx + 1]
            start_interval = harmonic_interval(start_upper, start_lower)
            end_interval = harmonic_interval(end_upper, end_lower)
            motion = motion_direction(start_upper.pitch.ps, end_upper.pitch.ps) * motion_direction(start_lower.pitch.ps, end_lower.pitch.ps)

            if motion > 0 and is_perfect_fifth(start_interval) and is_perfect_fifth(end_interval):
                violations.append(
                    violation(end_upper, "parallel_fifths", f"Parallel fifths between {start_upper.voice} and {start_lower.voice}", [start_upper.voice, start_lower.voice])
                )

            if motion > 0 and is_octave(start_interval) and is_octave(end_interval):
                violations.append(
                    violation(end_upper, "parallel_octaves", f"Parallel octaves between {start_upper.voice} and {start_lower.voice}", [start_upper.voice, start_lower.voice])
                )

            if motion > 0 and (is_octave(end_interval) or is_perfect_fifth(end_interval)):
                upper_leap = abs(end_upper.pitch.ps - start_upper.pitch.ps)
                if upper_leap > 2 and not (is_octave(start_interval) or is_perfect_fifth(start_interval)):
                    violations.append(
                        violation(end_upper, "direct_octaves", f"Similar motion into a perfect interval between {start_upper.voice} and {start_lower.voice}", [start_upper.voice, start_lower.voice])
                    )

    if analyzed_key is not None:
        for voice_line in voices:
            violations.extend(unresolved_leading_tones(voice_line, analyzed_key))

    return {"violations": dedupe_violations(violations)}


def iter_chords(score: stream.Score) -> Iterable[chord.Chord]:
    chordified = score.chordify()
    for ch in chordified.recurse().getElementsByClass(chord.Chord):
        if ch.pitches:
            yield ch


def chord_summary(ch: chord.Chord) -> dict[str, Any]:
    return {
        "bar": measure_number(ch),
        "beat": float(getattr(ch, "beat", 1.0) or 1.0),
        "pitches": [p.nameWithOctave for p in ch.pitches],
        "name": chord_name(ch),
        "duration": float(ch.duration.quarterLength),
    }


def roman_summary(ch: chord.Chord, analyzed_key: key.Key) -> dict[str, Any]:
    try:
        rn = roman.romanNumeralFromChord(ch, analyzed_key)
        figure = rn.figure
    except Exception:
        figure = None

    return {
        "bar": measure_number(ch),
        "beat": float(getattr(ch, "beat", 1.0) or 1.0),
        "roman": figure,
        "name": chord_name(ch),
        "notes": [p.name for p in ch.pitches],
        "pitches": [p.nameWithOctave for p in ch.pitches],
    }


def chord_name(ch: chord.Chord) -> str:
    root = ch.root()
    if root is None:
        return ch.commonName
    if ch.isMajorTriad():
        return f"{root.name} major"
    if ch.isMinorTriad():
        return f"{root.name} minor"
    if ch.isDiminishedTriad():
        return f"{root.name} diminished"
    if ch.isAugmentedTriad():
        return f"{root.name} augmented"
    if ch.isDominantSeventh():
        return f"{root.name} dominant seventh"
    return ch.commonName


def measure_number(element: Any) -> int:
    number = getattr(element, "measureNumber", None)
    if number is not None:
        return int(number)
    measure = element.getContextByClass(stream.Measure)
    return int(getattr(measure, "measureNumber", 0) or 0)


def format_key(analyzed_key: key.Key) -> str:
    return f"{analyzed_key.tonic.name} {analyzed_key.mode}"


def key_confidence(analyzed_key: key.Key) -> float | None:
    confidence = getattr(analyzed_key, "correlationCoefficient", None)
    return float(confidence) if confidence is not None else None


def first_time_signature(score: stream.Score) -> str:
    signatures = score.recurse().getElementsByClass(meter.TimeSignature)
    if len(signatures) == 0:
        return "unknown"
    return signatures[0].ratioString


def voice_ranges(score: stream.Score) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for index, part in enumerate(score.parts):
        pitches = [n.pitch for n in part.recurse().notes if isinstance(n, note.Note)]
        if not pitches:
            continue
        lowest = min(pitches, key=lambda p: p.ps)
        highest = max(pitches, key=lambda p: p.ps)
        result.append({"name": part_name(part, index), "lowest": lowest.nameWithOctave, "highest": highest.nameWithOctave})
    return result


def extract_voice_lines(score: stream.Score) -> list[list[TimedPitch]]:
    lines: list[list[TimedPitch]] = []
    for index, part in enumerate(score.parts):
        name = part_name(part, index)
        line: list[TimedPitch] = []
        for n in part.recurse().notes:
            if isinstance(n, note.Note):
                line.append(TimedPitch(n.pitch, measure_number(n), float(getattr(n, "beat", 1.0) or 1.0), name))
            elif isinstance(n, chord.Chord) and n.pitches:
                selected = max(n.pitches, key=lambda p: p.ps)
                line.append(TimedPitch(selected, measure_number(n), float(getattr(n, "beat", 1.0) or 1.0), name))
        if line:
            lines.append(line)
    return lines


def part_name(part: stream.Part, index: int) -> str:
    return part.partName or part.partAbbreviation or part.id or f"Voice {index + 1}"


def harmonic_interval(upper: TimedPitch, lower: TimedPitch) -> interval.Interval:
    return interval.Interval(noteStart=lower.pitch, noteEnd=upper.pitch)


def is_perfect_fifth(ivl: interval.Interval) -> bool:
    return ivl.simpleName == "P5"


def is_octave(ivl: interval.Interval) -> bool:
    return ivl.simpleName in {"P1", "P8"}


def motion_direction(start: float, end: float) -> int:
    if end > start:
        return 1
    if end < start:
        return -1
    return 0


def violation(source: TimedPitch, violation_type: str, description: str, voices: list[str]) -> dict[str, Any]:
    return {"bar": source.bar, "beat": source.beat, "type": violation_type, "description": description, "voices": voices}


def safe_analyze_key(score: stream.Score) -> key.Key | None:
    try:
        return score.analyze("key")
    except Exception:
        return None


def unresolved_leading_tones(line: list[TimedPitch], analyzed_key: key.Key) -> list[dict[str, Any]]:
    leading_pitch = analyzed_key.pitchFromDegree(7).pitchClass
    result: list[dict[str, Any]] = []
    for current, following in zip(line, line[1:]):
        if current.pitch.pitchClass == leading_pitch and following.pitch.ps - current.pitch.ps not in (1, 2):
            result.append(
                violation(
                    following,
                    "unresolved_leading_tone",
                    f"Leading tone {current.pitch.nameWithOctave} in {current.voice} does not resolve upward",
                    [current.voice],
                )
            )
    return result


def dedupe_violations(violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    result: list[dict[str, Any]] = []
    for item in violations:
        key_tuple = (item["bar"], item["beat"], item["type"], item["description"], tuple(item["voices"]))
        if key_tuple not in seen:
            seen.add(key_tuple)
            result.append(item)
    return result


def print_json(value: dict[str, Any]) -> None:
    print(json.dumps(value, separators=(",", ":")))


if __name__ == "__main__":
    sys.exit(main())
