#!/usr/bin/env python3
"""Normalize MusicXML or compressed MXL into Vellum's score-event JSON shape."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def children(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in element if local_name(child.tag) == name]


def child(element: ET.Element, name: str) -> ET.Element | None:
    return next((candidate for candidate in element if local_name(candidate.tag) == name), None)


def child_text(element: ET.Element, name: str, default: str | None = None) -> str | None:
    found = child(element, name)
    return found.text.strip() if found is not None and found.text else default


def fraction_json(value: Fraction) -> dict[str, int]:
    return {"numerator": value.numerator, "denominator": value.denominator}


def slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "part"


def load_root(file_path: Path) -> ET.Element:
    if file_path.suffix.lower() != ".mxl":
        return ET.parse(file_path).getroot()

    with zipfile.ZipFile(file_path) as archive:
        root_name = None
        if "META-INF/container.xml" in archive.namelist():
            container = ET.fromstring(archive.read("META-INF/container.xml"))
            for element in container.iter():
                if local_name(element.tag) == "rootfile":
                    root_name = element.attrib.get("full-path")
                    if root_name:
                        break
        if root_name is None:
            root_name = next(
                (
                    name
                    for name in archive.namelist()
                    if name.lower().endswith((".musicxml", ".xml"))
                    and not name.startswith("META-INF/")
                ),
                None,
            )
        if root_name is None:
            raise ValueError("Compressed MXL contains no MusicXML root file")
        return ET.fromstring(archive.read(root_name))


def key_name(fifths: int, mode: str) -> str:
    major = {
        -7: "Cb",
        -6: "Gb",
        -5: "Db",
        -4: "Ab",
        -3: "Eb",
        -2: "Bb",
        -1: "F",
        0: "C",
        1: "G",
        2: "D",
        3: "A",
        4: "E",
        5: "B",
        6: "F#",
        7: "C#",
    }
    minor = {
        -7: "Ab",
        -6: "Eb",
        -5: "Bb",
        -4: "F",
        -3: "C",
        -2: "G",
        -1: "D",
        0: "A",
        1: "E",
        2: "B",
        3: "F#",
        4: "C#",
        5: "G#",
        6: "D#",
        7: "A#",
    }
    names = minor if mode == "minor" else major
    return f"{names.get(fifths, 'unknown')} {mode}"


def pitch_text(note: ET.Element) -> str:
    pitch = child(note, "pitch")
    if pitch is None:
        raise ValueError("Pitched note has no pitch element")
    step = child_text(pitch, "step")
    octave = child_text(pitch, "octave")
    alter = int(child_text(pitch, "alter", "0") or "0")
    if not step or octave is None:
        raise ValueError("Pitch is missing step or octave")
    if alter not in (-1, 0, 1):
        raise ValueError(f"Unsupported chromatic alteration: {alter}")
    accidental = "#" if alter == 1 else "b" if alter == -1 else ""
    return f"{step}{accidental}{octave}"


def normalize(root: ET.Element) -> dict[str, object]:
    if local_name(root.tag) not in {"score-partwise", "score-timewise"}:
        raise ValueError(f"Unsupported MusicXML root: {local_name(root.tag)}")
    if local_name(root.tag) == "score-timewise":
        raise ValueError("score-timewise MusicXML is not supported yet")

    part_names: dict[str, str] = {}
    part_list = child(root, "part-list")
    if part_list is not None:
        for score_part in children(part_list, "score-part"):
            part_id = score_part.attrib.get("id", "")
            part_names[part_id] = child_text(score_part, "part-name", part_id) or part_id

    title = None
    work = child(root, "work")
    if work is not None:
        title = child_text(work, "work-title")
    if title is None:
        movement_title = child_text(root, "movement-title")
        title = movement_title

    raw_events: list[dict[str, object]] = []
    voice_names: dict[tuple[str, str], str] = {}
    measure_durations: dict[int, Fraction] = {}
    time_signature = None
    score_key = None

    for part_index, part in enumerate(children(root, "part"), start=1):
        xml_part_id = part.attrib.get("id", f"P{part_index}")
        part_name = part_names.get(xml_part_id, xml_part_id)
        divisions = 1
        event_counts: dict[str, int] = {}

        for measure_index, measure in enumerate(children(part, "measure")):
            cursor = Fraction(0)
            measure_max = Fraction(0)
            last_onset_by_voice: dict[str, Fraction] = {}
            attributes = child(measure, "attributes")
            if attributes is not None:
                divisions_text = child_text(attributes, "divisions")
                if divisions_text:
                    divisions = int(divisions_text)
                time = child(attributes, "time")
                if time is not None and time_signature is None:
                    beats = child_text(time, "beats")
                    beat_type = child_text(time, "beat-type")
                    if beats and beat_type:
                        time_signature = f"{beats}/{beat_type}"
                key = child(attributes, "key")
                if key is not None and score_key is None:
                    fifths = int(child_text(key, "fifths", "0") or "0")
                    mode = child_text(key, "mode", "major") or "major"
                    score_key = key_name(fifths, mode)

            for item in measure:
                name = local_name(item.tag)
                if name == "backup":
                    duration = int(child_text(item, "duration", "0") or "0")
                    cursor -= Fraction(duration, divisions)
                    continue
                if name == "forward":
                    duration = int(child_text(item, "duration", "0") or "0")
                    cursor += Fraction(duration, divisions)
                    measure_max = max(measure_max, cursor)
                    continue
                if name != "note" or child(item, "grace") is not None:
                    continue

                duration_text = child_text(item, "duration")
                if duration_text is None:
                    continue
                duration = Fraction(int(duration_text), divisions)
                voice = child_text(item, "voice", "1") or "1"
                voice_key = (xml_part_id, voice)
                voice_names[voice_key] = (
                    part_name if voice == "1" else f"{part_name} - Voice {voice}"
                )
                is_chord = child(item, "chord") is not None
                onset = last_onset_by_voice.get(voice, cursor) if is_chord else cursor
                if not is_chord:
                    last_onset_by_voice[voice] = onset
                    cursor += duration
                measure_max = max(measure_max, onset + duration, cursor)
                event_counts[voice] = event_counts.get(voice, 0) + 1
                event_id = (
                    f"event.{slug(xml_part_id)}-voice-{slug(voice)}.{event_counts[voice]}"
                )
                part_id = f"part.{slug(xml_part_id)}-voice-{slug(voice)}"
                event: dict[str, object] = {
                    "id": event_id,
                    "type": "rest" if child(item, "rest") is not None else "note",
                    "partId": part_id,
                    "measureId": f"measure.{measure_index}",
                    "onset": fraction_json(onset),
                    "duration": fraction_json(duration),
                }
                if event["type"] == "note":
                    event["pitch"] = pitch_text(item)
                tie_types = [
                    tie.attrib.get("type") for tie in children(item, "tie") if tie.attrib.get("type")
                ]
                if "start" in tie_types:
                    event["tie"] = "start"
                elif "stop" in tie_types:
                    event["tie"] = "stop"
                raw_events.append(event)

            measure_durations[measure_index] = max(
                measure_durations.get(measure_index, Fraction(0)), measure_max
            )

    parts = [
        {
            "id": f"part.{slug(xml_part_id)}-voice-{slug(voice)}",
            "name": name,
            "role": "other",
        }
        for (xml_part_id, voice), name in sorted(voice_names.items())
    ]
    measures = [
        {
            "id": f"measure.{index}",
            "index": index,
            "displayNumber": str(index if index > 0 else 0),
            "duration": fraction_json(duration),
        }
        for index, duration in sorted(measure_durations.items())
    ]

    result: dict[str, object] = {
        "parts": parts,
        "measures": measures,
        "events": raw_events,
        "uncertainties": [],
    }
    if title:
        result["title"] = title
    if time_signature:
        result["timeSignature"] = time_signature
    if score_key:
        result["key"] = score_key
    return result


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Expected one MusicXML or MXL file path"}), file=sys.stderr)
        return 2
    try:
        result = normalize(load_root(Path(sys.argv[1])))
        json.dump(result, sys.stdout, separators=(",", ":"))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI error boundary
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
