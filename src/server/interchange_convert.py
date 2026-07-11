#!/usr/bin/env python3
"""Convert a music21-supported interchange source to uncompressed MusicXML."""

from pathlib import Path
import sys

from music21 import converter


def main() -> None:
    if len(sys.argv) != 2:
        raise ValueError("usage: interchange_convert.py INPUT")
    source = Path(sys.argv[1])
    score = converter.parse(source)
    score.write("musicxml", fp="converted.musicxml")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
