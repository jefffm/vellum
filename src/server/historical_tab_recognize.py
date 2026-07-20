#!/usr/bin/env python3
"""Extract source geometry and uninterpreted glyph evidence from printed tablature.

The recognizer deliberately stops before assigning musical meaning.  It emits
page-relative systems, staff lines, barline candidates, glyph components, and
horizontal event groups suitable for a source-adaptive review workstation.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import sys
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class Box:
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left + 1

    @property
    def height(self) -> int:
        return self.bottom - self.top + 1

    def normalized(self, width: int, height: int) -> dict[str, float]:
        return {
            "x": self.left / width,
            "y": self.top / height,
            "width": self.width / width,
            "height": self.height / height,
        }


def grouped(values: list[int], maximum_gap: int) -> list[list[int]]:
    result: list[list[int]] = []
    for value in values:
        if not result or value - result[-1][-1] > maximum_gap:
            result.append([])
        result[-1].append(value)
    return result


def threshold_for(image: Image.Image) -> int:
    histogram = image.histogram()
    total = sum(histogram)
    weighted_total = sum(index * count for index, count in enumerate(histogram))
    background_weight = 0
    background_sum = 0
    best_variance = -1.0
    best = 160
    for value, count in enumerate(histogram):
        background_weight += count
        if background_weight == 0 or background_weight == total:
            continue
        background_sum += value * count
        foreground_weight = total - background_weight
        background_mean = background_sum / background_weight
        foreground_mean = (weighted_total - background_sum) / foreground_weight
        variance = background_weight * foreground_weight * (background_mean - foreground_mean) ** 2
        if variance > best_variance:
            best_variance = variance
            best = value
    return max(90, min(205, best))


def detect_staff_lines(mask: list[bytearray], width: int) -> list[list[int]]:
    left = int(width * 0.03)
    right = int(width * 0.97)
    minimum_ink = int((right - left) * 0.20)
    candidates = [
        y for y, row in enumerate(mask) if sum(row[left:right]) >= minimum_ink
    ]
    centers: list[int] = []
    for run in grouped(candidates, 6):
        centers.append(max(run, key=lambda y: sum(mask[y][left:right])))

    systems: list[list[int]] = []
    for neighborhood in grouped(centers, 70):
        if len(neighborhood) < 5:
            continue
        choices: list[tuple[float, list[int]]] = []
        for values in itertools.combinations(neighborhood, 5):
            candidate = list(values)
            gaps = [candidate[index + 1] - candidate[index] for index in range(4)]
            mean = sum(gaps) / len(gaps)
            if 10 <= mean <= 60:
                choices.append((sum((gap - mean) ** 2 for gap in gaps), candidate))
        if choices:
            systems.append(min(choices, key=lambda choice: choice[0])[1])
    if not systems:
        raise ValueError("No five-line tablature systems were detected")
    return systems


def remove_horizontal_rules(mask: list[bytearray], minimum_run: int) -> list[bytearray]:
    cleaned = [bytearray(row) for row in mask]
    for row in cleaned:
        start: int | None = None
        for x in range(len(row) + 1):
            value = row[x] if x < len(row) else 0
            if value and start is None:
                start = x
            elif not value and start is not None:
                if x - start >= minimum_run:
                    row[start:x] = bytes(x - start)
                start = None
    return cleaned


def staff_horizontal_span(mask: list[bytearray], lines: list[int], width: int) -> tuple[int, int]:
    """Find the shared five-line staff run, excluding titles and page furniture."""
    band_prefixes: list[list[int]] = []
    for line in lines:
        prefix = [0]
        for x in range(width):
            prefix.append(
                prefix[-1]
                + sum(
                    mask[y][x]
                    for y in range(max(0, line - 3), min(len(mask), line + 4))
                )
            )
        band_prefixes.append(prefix)
    radius = max(30, int(width * 0.02))
    active: list[int] = []
    for x in range(width):
        left = max(0, x - radius)
        right = min(width, x + radius + 1)
        supporting_lines = sum(
            prefix[right] - prefix[left] >= 8 for prefix in band_prefixes
        )
        if supporting_lines >= 3:
            active.append(x)
    runs = grouped(active, max(radius * 2, int(width * 0.15)))
    credible = [run for run in runs if run[-1] - run[0] >= width * 0.5]
    if not credible:
        return int(width * 0.025), int(width * 0.975)
    span = max(credible, key=lambda run: run[-1] - run[0])
    return span[0], span[-1]


def normalized_shape(box: Box, pixels: list[tuple[int, int]]) -> tuple[str, str]:
    """Hash a coarse translation/scale-normalized projection descriptor.

    Row/column densities are quantized so minor scan noise does not prevent the
    same printed letter recurring. Aspect and fill bins prevent unrelated marks
    with similar projections from collapsing together. This descriptor is used
    only after a component passes the strict course-aligned letter-size gate.
    """
    rows = [0] * 8
    columns = [0] * 8
    for pixel_x, pixel_y in pixels:
        column = min(7, int((pixel_x - box.left) * 8 / box.width))
        row = min(7, int((pixel_y - box.top) * 8 / box.height))
        columns[column] += 1
        rows[row] += 1

    def quantized(values: list[int]) -> list[int]:
        peak = max(values) or 1
        return [min(7, round(value * 7 / peak)) for value in values]

    descriptor = bytearray(
        [
            min(15, round(box.width / box.height * 8)),
            min(15, round(len(pixels) / (box.width * box.height) * 15)),
            *quantized(rows),
            *quantized(columns),
        ]
    )
    shape_code = bytes(descriptor).hex()
    return hashlib.sha256(bytes(descriptor)).hexdigest(), shape_code


def shape_distance(left: str, right: str) -> int:
    left_values = bytes.fromhex(left)
    right_values = bytes.fromhex(right)
    return sum(
        abs(left_value - right_value) * (2 if index < 2 else 1)
        for index, (left_value, right_value) in enumerate(zip(left_values, right_values))
    )


def components(
    mask: list[bytearray], bounds: Box, minimum_area: int = 5
) -> list[tuple[Box, int, str, str, str]]:
    width = len(mask[0])
    seen: set[int] = set()
    found: list[tuple[Box, int, str, str, str]] = []
    for y in range(bounds.top, bounds.bottom + 1):
        for x in range(bounds.left, bounds.right + 1):
            key = y * width + x
            if not mask[y][x] or key in seen:
                continue
            queue = deque([(x, y)])
            seen.add(key)
            pixels: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.popleft()
                pixels.append((current_x, current_y))
                for next_y in range(max(bounds.top, current_y - 1), min(bounds.bottom, current_y + 1) + 1):
                    for next_x in range(max(bounds.left, current_x - 1), min(bounds.right, current_x + 1) + 1):
                        next_key = next_y * width + next_x
                        if mask[next_y][next_x] and next_key not in seen:
                            seen.add(next_key)
                            queue.append((next_x, next_y))
            if len(pixels) < minimum_area:
                continue
            box = Box(
                min(pixel[0] for pixel in pixels),
                min(pixel[1] for pixel in pixels),
                max(pixel[0] for pixel in pixels),
                max(pixel[1] for pixel in pixels),
            )
            fingerprint = hashlib.sha256(
                ";".join(
                    f"{pixel_x - box.left},{pixel_y - box.top}"
                    for pixel_x, pixel_y in sorted(pixels, key=lambda item: (item[1], item[0]))
                ).encode("ascii")
            ).hexdigest()
            shape_fingerprint, shape_code = normalized_shape(box, pixels)
            found.append((box, len(pixels), fingerprint, shape_fingerprint, shape_code))
    return found


def event_anchors(cleaned: list[bytearray], bounds: Box, gap: float) -> list[int]:
    scores = [
        sum(cleaned[y][x] for y in range(bounds.top, bounds.bottom + 1))
        for x in range(len(cleaned[0]))
    ]
    minimum_score = max(12, int(gap * 1.25))
    candidates = sorted(
        (
            x
            for x in range(bounds.left + 3, bounds.right - 2)
            if scores[x] >= minimum_score
            and scores[x] == max(scores[x - 3 : x + 4])
        ),
        key=lambda x: (-scores[x], x),
    )
    separation = max(24, int(gap * 1.4))
    selected: list[int] = []
    for candidate in candidates:
        if all(abs(candidate - prior) >= separation for prior in selected):
            selected.append(candidate)
    return sorted(selected)


def vertical_candidates(
    mask: list[bytearray],
    lines: list[int],
    width: int,
    height: int,
    system_index: int,
    left: int,
    right: int,
) -> list[dict]:
    staff_rows = [
        y
        for y in range(lines[0], lines[-1] + 1)
        if all(abs(y - line) > 4 for line in lines)
    ]
    active: list[tuple[int, float]] = []
    for x in range(max(2, left), min(width - 2, right + 1)):
        coverage = sum(
            any(mask[y][nearby] for nearby in range(x - 2, x + 3))
            for y in staff_rows
        ) / len(staff_rows)
        if coverage >= 0.72:
            active.append((x, coverage))
    result: list[dict] = []
    for index, run in enumerate(grouped([x for x, _coverage in active], 3), 1):
        coverage = max(dict(active)[x] for x in run)
        box = Box(run[0], lines[0], run[-1], lines[-1])
        result.append(
            {
                "id": f"system-{system_index}-vertical-{index}",
                "region": box.normalized(width, height),
                "coverage": round(coverage, 4),
                "classification": "barline-like" if coverage >= 0.9 else "unresolved-vertical-mark",
            }
        )
    return result


def default_profile(course_count: int) -> dict:
    return {
        "id": "profile.french-five-course.printed.unlabeled",
        "version": 1,
        "courseCount": course_count,
        "notationType": "tab.lute.french",
        "vocabulary": list("abcdefghiklmn"),
        "spatialRules": {
            "courseAlignmentToleranceGap": 0.65,
            "minimumGlyphWidthGap": 0.4,
            "maximumGlyphWidthGap": 1.35,
            "minimumGlyphHeightGap": 0.4,
            "maximumGlyphHeightGap": 1.45,
            "shapeDistanceThreshold": 8,
        },
    }


def recognize(image_path: Path, course_count: int, profile: dict | None = None) -> dict:
    profile = profile or default_profile(course_count)
    if profile["courseCount"] != course_count or profile["notationType"] != "tab.lute.french":
        raise ValueError("recognition profile is incompatible with printed French tablature")
    rules = profile["spatialRules"]
    image = Image.open(image_path).convert("L")
    width, height = image.size
    threshold = threshold_for(image)
    pixels = image.load()
    mask = [bytearray(1 if pixels[x, y] <= threshold else 0 for x in range(width)) for y in range(height)]
    staff_systems = detect_staff_lines(mask, width)
    cleaned = remove_horizontal_rules(mask, max(24, int(width * 0.012)))
    systems: list[dict] = []
    all_glyphs: list[dict] = []

    for system_index, lines in enumerate(staff_systems, 1):
        gap = sum(lines[index + 1] - lines[index] for index in range(4)) / 4
        staff_left, staff_right = staff_horizontal_span(mask, lines, width)
        bounds = Box(
            max(0, int(staff_left - gap * 0.8)),
            max(0, int(lines[0] - gap * 3.7)),
            min(width - 1, int(staff_right + gap * 0.5)),
            min(height - 1, int(lines[-1] + gap * 2.2)),
        )
        raw_components = components(cleaned, bounds)
        glyphs: list[dict] = []
        barlines = vertical_candidates(
            mask, lines, width, height, system_index, staff_left, staff_right
        )
        for component_index, (box, area, fingerprint, shape_fingerprint, shape_code) in enumerate(raw_components, 1):
            if box.width > width * 0.12 and box.height < gap * 0.8:
                continue
            item = {
                "id": f"system-{system_index}-glyph-{component_index}",
                "region": box.normalized(width, height),
                "pixelBounds": {
                    "left": box.left,
                    "top": box.top,
                    "right": box.right,
                    "bottom": box.bottom,
                },
                "area": area,
                "fingerprint": fingerprint,
                "shapeFingerprint": shape_fingerprint,
                "shapeCode": shape_code,
            }
            center_y = (box.top + box.bottom) / 2
            nearest_course = min(range(len(lines)), key=lambda index: abs(lines[index] - center_y))
            if (
                abs(lines[nearest_course] - center_y)
                <= gap * rules["courseAlignmentToleranceGap"]
            ):
                item["courseCandidate"] = nearest_course + 1
            item["clusterEligible"] = bool(
                item.get("courseCandidate")
                and gap * rules["minimumGlyphWidthGap"]
                <= box.width
                <= gap * rules["maximumGlyphWidthGap"]
                and gap * rules["minimumGlyphHeightGap"]
                <= box.height
                <= gap * rules["maximumGlyphHeightGap"]
                and area >= max(10, int(gap * gap * 0.035))
            )
            glyphs.append(item)
            all_glyphs.append(item)

        anchors = event_anchors(cleaned, bounds, gap)
        events: list[dict] = []
        for event_index, anchor in enumerate(anchors, 1):
            left_edge = (
                bounds.left
                if event_index == 1
                else (anchors[event_index - 2] + anchor) // 2
            )
            right_edge = (
                bounds.right
                if event_index == len(anchors)
                else (anchor + anchors[event_index]) // 2 - 1
            )
            members = [
                glyph
                for glyph in glyphs
                if left_edge
                <= (glyph["pixelBounds"]["left"] + glyph["pixelBounds"]["right"]) / 2
                <= right_edge
            ]
            event_box = Box(left_edge, bounds.top, right_edge, bounds.bottom)
            events.append(
                {
                    "id": f"system-{system_index}-event-{event_index}",
                    "region": event_box.normalized(width, height),
                    "anchorX": anchor / width,
                    "glyphIds": [member["id"] for member in members],
                    "verticalCandidateIds": [
                        candidate["id"]
                        for candidate in barlines
                        if left_edge
                        <= (candidate["region"]["x"] + candidate["region"]["width"] / 2) * width
                        <= right_edge
                    ],
                    "reviewState": "unreviewed",
                }
            )
        systems.append(
            {
                "id": f"system-{system_index}",
                "region": bounds.normalized(width, height),
                "staffLines": [line / height for line in lines],
                "staffPixelLines": lines,
                "barlines": barlines,
                "events": events,
            }
        )

    fret_clusters: list[dict[str, object]] = []
    raw_clusters: list[tuple[str, list[str]]] = []
    for glyph in all_glyphs:
        if glyph["clusterEligible"]:
            matches = sorted(
                (
                    (shape_distance(glyph["shapeCode"], str(cluster["shapeCode"])), cluster)
                    for cluster in fret_clusters
                ),
                key=lambda item: item[0],
            )
            if matches and matches[0][0] <= rules["shapeDistanceThreshold"]:
                matches[0][1]["glyphIds"].append(glyph["id"])
            else:
                fret_clusters.append(
                    {"shapeCode": glyph["shapeCode"], "glyphIds": [glyph["id"]]}
                )
        else:
            raw_clusters.append((glyph["fingerprint"], [glyph["id"]]))
    ordered_clusters = [
        ("fret-letter", str(cluster["shapeCode"]), list(cluster["glyphIds"]))
        for cluster in sorted(
            fret_clusters,
            key=lambda item: (-len(item["glyphIds"]), item["glyphIds"][0]),
        )
    ] + [("other", signature, ids) for signature, ids in raw_clusters]
    clusters = [
        {
            "id": f"cluster-{index}",
            "kind": kind,
            "signature": f"{'fret' if kind == 'fret-letter' else 'raw'}:{hashlib.sha256(bytes.fromhex(signature)).hexdigest() if kind == 'fret-letter' else signature}",
            "shapeCode": signature if kind == "fret-letter" else None,
            "glyphIds": ids,
            "label": None,
        }
        for index, (kind, signature, ids) in enumerate(ordered_clusters, 1)
    ]
    cluster_for = {glyph_id: cluster["id"] for cluster in clusters for glyph_id in cluster["glyphIds"]}
    for glyph in all_glyphs:
        glyph["clusterId"] = cluster_for[glyph["id"]]

    return {
        "schemaVersion": 1,
        "backend": {"id": "vellum.printed-tab-geometry", "version": "2"},
        "profile": profile,
        "image": {"width": width, "height": height, "threshold": threshold},
        "systems": systems,
        "glyphs": all_glyphs,
        "clusters": clusters,
        "hypotheses": [],
        "diagnostics": [
            f"Detected {len(systems)} five-line systems.",
            f"Extracted {len(all_glyphs)} uninterpreted glyph components; {len(fret_clusters)} conservative fret-letter clusters are eligible for reviewed reuse.",
            "No course letter, rhythm, ornament, gesture, or duration was accepted automatically.",
        ],
    }


def main() -> None:
    if len(sys.argv) not in (2, 3, 4):
        raise SystemExit(
            "usage: historical_tab_recognize.py PAGE.png [COURSE_COUNT] [PROFILE.json]"
        )
    course_count = int(sys.argv[2]) if len(sys.argv) == 3 else 5
    if course_count != 5:
        raise SystemExit("the initial printed French-tablature profile requires five courses")
    profile = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) == 4 else None
    print(
        json.dumps(
            recognize(Path(sys.argv[1]), course_count, profile), separators=(",", ":")
        )
    )


if __name__ == "__main__":
    main()
