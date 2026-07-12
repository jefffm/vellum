#!/usr/bin/env python3
"""Normalize MusicXML or compressed MXL into Vellum's score-event JSON shape."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from collections import defaultdict
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


NOTE_TYPE_QUARTERS = {
    "maxima": Fraction(32), "long": Fraction(16), "breve": Fraction(8),
    "whole": Fraction(4), "half": Fraction(2), "quarter": Fraction(1),
    "eighth": Fraction(1, 2), "16th": Fraction(1, 4), "32nd": Fraction(1, 8),
    "64th": Fraction(1, 16), "128th": Fraction(1, 32), "256th": Fraction(1, 64),
}


def written_rhythm(note, event_id: str, tuplet_state: dict[str, tuple[str, int, int]]) -> dict[str, object] | None:
    note_type = child_text(note, "type")
    if not note_type or note_type not in NOTE_TYPE_QUARTERS:
        return None
    dots = len(children(note, "dot"))
    written = NOTE_TYPE_QUARTERS[note_type]
    addition = written
    for _ in range(dots):
        addition /= 2
        written += addition
    notation: dict[str, object] = {"writtenDuration": fraction_json(written), "dots": dots}
    modification = child(note, "time-modification")
    if modification is None:
        return notation
    actual = int(child_text(modification, "actual-notes", "0") or "0")
    normal = int(child_text(modification, "normal-notes", "0") or "0")
    if actual < 2 or normal < 1:
        return notation
    voice = child_text(note, "voice", "1") or "1"
    marks = []
    notations = child(note, "notations")
    if notations is not None:
        marks = [item.attrib.get("type") for item in children(notations, "tuplet")]
    starts = "start" in marks
    stops = "stop" in marks
    if starts or voice not in tuplet_state:
        group_id = f"tuplet.{event_id.removeprefix('event.')}"
        tuplet_state[voice] = (group_id, actual, normal)
    group_id, _, _ = tuplet_state[voice]
    boundary = "start_stop" if starts and stops else "start" if starts else "stop" if stops else "continue"
    notation["tuplet"] = {
        "groupId": group_id,
        "actualNotes": actual,
        "normalNotes": normal,
        "boundary": boundary,
    }
    if stops:
        tuplet_state.pop(voice, None)
    return notation


def performed_form(root, measure_count: int) -> dict[str, object]:
    first_part = children(root, "part")[0] if children(root, "part") else None
    measures = children(first_part, "measure") if first_part is not None else []
    repeat_start = 0
    repeated: set[int] = set()
    iteration = 1
    cursor = 0
    occurrences: list[dict[str, object]] = []
    decisions: list[str] = []
    ending_by_measure: dict[int, set[int]] = {}
    active_endings: set[int] = set()
    for index, measure in enumerate(measures):
        for barline in children(measure, "barline"):
            ending = child(barline, "ending")
            if ending is not None and ending.attrib.get("type") == "start":
                active_endings = {
                    int(value.strip())
                    for value in ending.attrib.get("number", "").replace("-", ",").split(",")
                    if value.strip().isdigit()
                }
        if active_endings:
            ending_by_measure[index] = set(active_endings)
        for barline in children(measure, "barline"):
            ending = child(barline, "ending")
            if ending is not None and ending.attrib.get("type") in {"stop", "discontinue"}:
                active_endings = set()
    steps = 0
    while cursor < min(measure_count, len(measures)) and steps < max(1, measure_count * 4):
        steps += 1
        measure = measures[cursor]
        for barline in children(measure, "barline"):
            repeat = child(barline, "repeat")
            if repeat is not None and repeat.attrib.get("direction") == "forward":
                repeat_start = cursor
        endings = ending_by_measure.get(cursor, set())
        include_measure = not endings or iteration in endings
        occurrence: dict[str, object] = {
            "id": f"occurrence.measure-{cursor}.{len(occurrences) + 1}",
            "measureId": f"measure.{cursor}",
            "iteration": len([item for item in occurrences if item["measureId"] == f"measure.{cursor}"]) + 1,
        }
        if iteration > 1:
            occurrence["repeatIteration"] = iteration
        if endings:
            occurrence["ending"] = iteration
        if include_measure:
            occurrences.append(occurrence)
        backward = False
        for barline in children(measure, "barline"):
            repeat = child(barline, "repeat")
            if repeat is not None and repeat.attrib.get("direction") == "backward":
                backward = True
        if backward and cursor not in repeated:
            repeated.add(cursor)
            decisions.append(f"Repeat measures {repeat_start + 1}-{cursor + 1} once.")
            cursor = repeat_start
            iteration = 2
            continue
        cursor += 1
    if not decisions:
        decisions.append("Play written measures once in score order.")
    navigation = []
    for index, measure in enumerate(measures):
        for direction in children(measure, "direction"):
            sound = child(direction, "sound")
            if sound is not None and sound.attrib.get("dacapo") == "yes":
                navigation.append(("da_capo", index))
    if navigation:
        _, source_index = navigation[0]
        decisions.append(f"Da capo after measure {source_index + 1}.")
        fine_index = None
        for index, measure in enumerate(measures):
            if any(
                child(direction, "sound") is not None
                and child(direction, "sound").attrib.get("fine") == "yes"
                for direction in children(measure, "direction")
            ):
                fine_index = index
                break
        for index in range(0, (fine_index if fine_index is not None else source_index) + 1):
            occurrences.append({
                "id": f"occurrence.measure-{index}.{len(occurrences) + 1}",
                "measureId": f"measure.{index}",
                "iteration": len([item for item in occurrences if item["measureId"] == f"measure.{index}"]) + 1,
                "jump": "fine" if index == fine_index else "da_capo" if index == 0 else None,
            })
        for occurrence in occurrences:
            if occurrence.get("jump") is None:
                occurrence.pop("jump", None)
    else:
        sounds_by_measure: dict[int, list[object]] = {}
        for index, measure in enumerate(measures):
            sounds_by_measure[index] = [
                child(direction, "sound")
                for direction in children(measure, "direction")
                if child(direction, "sound") is not None
            ]
        ds_source = next(
            (
                index
                for index, sounds in sounds_by_measure.items()
                if any(sound.attrib.get("dalsegno") for sound in sounds)
            ),
            None,
        )
        if ds_source is not None:
            ds_label = next(sound.attrib["dalsegno"] for sound in sounds_by_measure[ds_source] if sound.attrib.get("dalsegno"))
            segno_index = next(
                (index for index, sounds in sounds_by_measure.items() if any(sound.attrib.get("segno") == ds_label for sound in sounds)),
                0,
            )
            coda_label = next(
                (sound.attrib["tocoda"] for sounds in sounds_by_measure.values() for sound in sounds if sound.attrib.get("tocoda")),
                None,
            )
            coda_index = next(
                (index for index, sounds in sounds_by_measure.items() if coda_label and any(sound.attrib.get("coda") == coda_label for sound in sounds)),
                None,
            )
            decisions.append(f"Dal segno after measure {ds_source + 1} to measure {segno_index + 1}.")
            index = segno_index
            jumped_to_coda = False
            while index < len(measures):
                jump = "dal_segno" if index == segno_index else None
                sounds = sounds_by_measure[index]
                if coda_index is not None and not jumped_to_coda and any(sound.attrib.get("tocoda") == coda_label for sound in sounds):
                    index = coda_index
                    jumped_to_coda = True
                    jump = "to_coda"
                    sounds = sounds_by_measure[index]
                occurrence = {
                    "id": f"occurrence.measure-{index}.{len(occurrences) + 1}",
                    "measureId": f"measure.{index}",
                    "iteration": len([item for item in occurrences if item["measureId"] == f"measure.{index}"]) + 1,
                }
                if jump:
                    occurrence["jump"] = jump
                occurrences.append(occurrence)
                if any(sound.attrib.get("fine") == "yes" for sound in sounds):
                    occurrence["jump"] = "fine"
                    break
                index += 1
    return {"id": "performed-form.imported", "measureOccurrences": occurrences, "traversalDecisions": decisions}


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


def inferred_role(part_name: str) -> str:
    lowered = part_name.lower()
    if "soprano" in lowered:
        return "soprano"
    if "continuo" in lowered or "figured bass" in lowered or "basso continuo" in lowered:
        return "continuo_foundation"
    if "bass" in lowered:
        return "bass"
    return "other"


def figured_bass_tokens(element: ET.Element) -> list[dict[str, object]]:
    accidental_names = {
        "sharp": "#",
        "flat": "b",
        "natural": "natural",
    }
    result: list[dict[str, object]] = []
    for figure in children(element, "figure"):
        number_text = child_text(figure, "figure-number")
        if not number_text or not number_text.isdigit():
            continue
        token: dict[str, object] = {"interval": int(number_text)}
        prefix = child_text(figure, "prefix")
        suffix = child_text(figure, "suffix")
        accidental = accidental_names.get(prefix or "") or accidental_names.get(suffix or "")
        if accidental:
            token["accidental"] = accidental
        result.append(token)
    return result


def audiveris_native_evidence(file_path: Path) -> tuple[dict[tuple[int, str], list[dict[str, object]]], list[int]]:
    queues: dict[tuple[int, str], list[dict[str, object]]] = defaultdict(list)
    pages: list[int] = []
    with zipfile.ZipFile(file_path) as archive:
        sheet_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.fullmatch(r"sheet#\d+/sheet#\d+\.xml", name)
            ),
            key=lambda name: int(re.search(r"sheet#(\d+)", name).group(1)),
        )
        for sheet_name in sheet_names:
            page = int(re.search(r"sheet#(\d+)", sheet_name).group(1))
            pages.append(page)
            root = ET.fromstring(archive.read(sheet_name))
            systems = [element for element in root.iter() if local_name(element.tag) == "system"]
            for system in systems:
                entities = {
                    element.attrib["id"]: element
                    for element in system.iter()
                    if "id" in element.attrib
                }
                members: dict[str, list[str]] = defaultdict(list)
                for relation in (
                    element for element in system.iter() if local_name(element.tag) == "relation"
                ):
                    if child(relation, "containment") is not None:
                        source = relation.attrib.get("source")
                        target = relation.attrib.get("target")
                        if source and target:
                            members[source].append(target)
                system_parts = children(system, "part")
                for physical_index, part in enumerate(system_parts, start=1):
                    part_index = int(part.attrib.get("id", physical_index))
                    for measure in children(part, "measure"):
                        for voice in children(measure, "voice"):
                            voice_id = voice.attrib.get("id", "1")
                            for entry in voice.iter():
                                if local_name(entry.tag) != "value" or entry.attrib.get("status") != "BEGIN":
                                    continue
                                chord_id = entry.attrib.get("chord")
                                chord = entities.get(chord_id or "")
                                if chord is None:
                                    continue
                                chord_kind = local_name(chord.tag)
                                note_members = [
                                    entities[member_id]
                                    for member_id in members.get(chord_id or "", [])
                                    if member_id in entities
                                    and local_name(entities[member_id].tag) in {"head", "rest"}
                                ]
                                if chord_kind == "head-chord":
                                    note_members.sort(
                                        key=lambda element: float(element.attrib.get("pitch", "0")),
                                        reverse=True,
                                    )
                                for member in note_members:
                                    bounds = child(member, "bounds")
                                    if bounds is None:
                                        continue
                                    grade_values = [
                                        float(value)
                                        for value in (
                                            member.attrib.get("ctx-grade"),
                                            member.attrib.get("grade"),
                                            chord.attrib.get("ctx-grade"),
                                            chord.attrib.get("grade"),
                                        )
                                        if value is not None
                                    ]
                                    confidence = min(grade_values) if grade_values else 1.0
                                    queues[(part_index, voice_id)].append(
                                        {
                                            "type": "rest"
                                            if local_name(member.tag) == "rest"
                                            else "note",
                                            "confidence": max(0.0, min(1.0, confidence)),
                                            "abnormal": member.attrib.get("abnormal") == "true",
                                            "region": {
                                                "coordinateSpace": "omr_raster",
                                                "page": page,
                                                "x": int(bounds.attrib["x"]),
                                                "y": int(bounds.attrib["y"]),
                                                "width": max(1, int(bounds.attrib["w"])),
                                                "height": max(1, int(bounds.attrib["h"])),
                                            },
                                        }
                                    )
    return dict(queues), pages


def normalize(
    root: ET.Element,
    native_queues: dict[tuple[int, str], list[dict[str, object]]] | None = None,
) -> tuple[dict[str, object], dict[str, int]]:
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
    evidence_offsets: dict[tuple[int, str], int] = defaultdict(int)
    evidence_stats = {"mapped": 0, "unmapped": 0, "unused": 0}
    notation_issues: list[dict[str, object]] = []

    for part_index, part in enumerate(children(root, "part"), start=1):
        xml_part_id = part.attrib.get("id", f"P{part_index}")
        part_name = part_names.get(xml_part_id, xml_part_id)
        divisions = 1
        event_counts: dict[str, int] = {}
        figure_count = 0
        tuplet_state: dict[str, tuple[str, int, int]] = {}

        for measure_index, measure in enumerate(children(part, "measure")):
            cursor = Fraction(0)
            measure_max = Fraction(0)
            last_onset_by_voice: dict[str, Fraction] = {}
            last_note_event: dict[str, object] | None = None
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
                if name == "figured-bass":
                    tokens = figured_bass_tokens(item)
                    if not tokens or last_note_event is None:
                        continue
                    figure_count += 1
                    duration_text = child_text(item, "duration")
                    duration = (
                        Fraction(int(duration_text), divisions)
                        if duration_text is not None
                        else Fraction(
                            int(last_note_event["duration"]["numerator"]),
                            int(last_note_event["duration"]["denominator"]),
                        )
                    )
                    raw_events.append(
                        {
                            "id": f"event.{slug(xml_part_id)}-figure.{figure_count}",
                            "type": "figured_bass",
                            "partId": last_note_event["partId"],
                            "measureId": last_note_event["measureId"],
                            "onset": last_note_event["onset"],
                            "duration": fraction_json(duration),
                            "bassEventId": last_note_event["id"],
                            "figures": tokens,
                        }
                    )
                    continue
                if name != "note":
                    continue

                if child(item, "grace") is not None:
                    issue_number = len(notation_issues) + 1
                    notation_issues.append({
                        "id": f"notation-issue.grace.{issue_number}",
                        "severity": "error",
                        "code": "unsupported_grace_note",
                        "message": "Grace-note timing is not yet supported and must be resolved before arrangement.",
                        "measureIds": [f"measure.{measure_index}"],
                        "eventIds": [],
                    })
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
                rhythmic_notation = written_rhythm(item, event_id, tuplet_state)
                if rhythmic_notation is not None:
                    event["rhythmicNotation"] = rhythmic_notation
                if event["type"] == "note":
                    event["pitch"] = pitch_text(item)
                if native_queues is not None:
                    evidence_key = (part_index, voice)
                    evidence_index = evidence_offsets[evidence_key]
                    candidates = native_queues.get(evidence_key, [])
                    evidence = candidates[evidence_index] if evidence_index < len(candidates) else None
                    if evidence is not None and evidence["type"] == event["type"]:
                        event["confidence"] = evidence["confidence"]
                        event["sourceRegion"] = evidence["region"]
                        event["_nativeAbnormal"] = evidence["abnormal"]
                        evidence_offsets[evidence_key] += 1
                        evidence_stats["mapped"] += 1
                    else:
                        evidence_stats["unmapped"] += 1
                tie_types = [
                    tie.attrib.get("type") for tie in children(item, "tie") if tie.attrib.get("type")
                ]
                if "start" in tie_types:
                    event["tie"] = "start"
                elif "stop" in tie_types:
                    event["tie"] = "stop"
                raw_events.append(event)
                if event["type"] == "note" and not is_chord:
                    last_note_event = event

            measure_durations[measure_index] = max(
                measure_durations.get(measure_index, Fraction(0)), measure_max
            )

    parts = [
        {
            "id": f"part.{slug(xml_part_id)}-voice-{slug(voice)}",
            "name": name,
            "role": inferred_role(name),
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
        "performedForm": performed_form(root, len(measures)),
        "notationIssues": notation_issues,
    }
    uncertainties: list[dict[str, object]] = []
    for event in raw_events:
        abnormal = bool(event.pop("_nativeAbnormal", False))
        confidence = event.get("confidence")
        if event["type"] != "note" or not isinstance(confidence, float):
            continue
        if confidence >= 0.8 and not abnormal:
            continue
        critical = abnormal
        uncertainties.append(
            {
                "id": f"uncertainty.{event['id'].removeprefix('event.')}",
                "eventIds": [event["id"]],
                "critical": critical,
                "category": "pitch_recognition",
                "message": f"Audiveris recognized {event['pitch']} with native confidence {confidence:.3f}.",
                "alternatives": [],
                "region": event.get("sourceRegion"),
                "resolved": False,
            }
        )
    if native_queues is not None and len(voice_names) == 1:
        simultaneous_notes: dict[tuple[str, int, int], list[dict[str, object]]] = defaultdict(list)
        for event in raw_events:
            if event["type"] != "note":
                continue
            onset = event["onset"]
            simultaneous_notes[
                (
                    str(event["measureId"]),
                    int(onset["numerator"]),
                    int(onset["denominator"]),
                )
            ].append(event)
        chordal_onsets = [events for events in simultaneous_notes.values() if len(events) >= 3]
        if len(chordal_onsets) >= 2:
            flattened_events = [event for onset_events in chordal_onsets for event in onset_events]
            regions = [event.get("sourceRegion") for event in flattened_events if event.get("sourceRegion")]
            voice_uncertainty: dict[str, object] = {
                "id": "uncertainty.polyphonic-voice-identity",
                "eventIds": [event["id"] for event in flattened_events],
                "critical": True,
                "category": "voice_identity",
                "message": (
                    f"Audiveris returned {len(chordal_onsets)} three-or-more-note onsets in one "
                    "recognized voice. Independent polyphonic voices may have been flattened into chords; "
                    "Principal Voice analysis is blocked until voice assignments are reviewed."
                ),
                "alternatives": [
                    "1. Restore independent soprano, alto, tenor, and bass voices by registral order.",
                    "2. Keep one chordal voice only if the source explicitly uses block chords.",
                ],
                "resolved": False,
            }
            if regions:
                voice_uncertainty["region"] = regions[0]
            uncertainties.append(voice_uncertainty)
    result["uncertainties"] = uncertainties
    if native_queues is not None:
        evidence_stats["unused"] = sum(
            max(0, len(queue) - evidence_offsets[key]) for key, queue in native_queues.items()
        )
    if title:
        result["title"] = title
    if time_signature:
        result["timeSignature"] = time_signature
    if score_key:
        result["key"] = score_key
    return result, evidence_stats


def main() -> int:
    if len(sys.argv) not in {2, 3}:
        print(json.dumps({"error": "Expected MusicXML/MXL and optional Audiveris OMR paths"}), file=sys.stderr)
        return 2
    try:
        native_queues = None
        pages: list[int] = []
        if len(sys.argv) == 3:
            native_queues, pages = audiveris_native_evidence(Path(sys.argv[2]))
        result, evidence_stats = normalize(load_root(Path(sys.argv[1])), native_queues)
        if native_queues is None:
            output: object = result
        else:
            diagnostics: list[dict[str, object]] = [
                {
                    "severity": "info",
                    "code": "audiveris.native-evidence",
                    "message": f"Mapped {evidence_stats['mapped']} score events to native Audiveris bounds and grades.",
                }
            ]
            if evidence_stats["unmapped"] or evidence_stats["unused"]:
                diagnostics.append(
                    {
                        "severity": "warning",
                        "code": "audiveris.evidence-mismatch",
                        "message": f"Native evidence correlation left {evidence_stats['unmapped']} score events unmapped and {evidence_stats['unused']} native symbols unused.",
                    }
                )
            output = {
                "recognizedScore": result,
                "pageMappings": [
                    {"sourcePage": page, "recognizedPage": page} for page in pages
                ],
                "diagnostics": diagnostics,
            }
        json.dump(output, sys.stdout, separators=(",", ":"))
        return 0
    except Exception as error:  # noqa: BLE001 - CLI error boundary
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
