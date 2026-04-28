/**
 * LyTree — Typed intermediate representation for LilyPond notation.
 *
 * Mirrors LilyPond's containment hierarchy as a tree of typed nodes.
 * The serializer walks the tree recursively and emits LilyPond text.
 *
 * Inspired by Abjad (Python LilyPond codegen library), scoped to what
 * Vellum's engrave tool needs.
 */

// === Indicators ===
// Attached to leaves or containers. Emitted at the attachment point
// during serialization. Order-stable.

export type LyIndicator =
  | { kind: "time_signature"; numerator: number; denominator: number }
  | { kind: "key_signature"; tonic: string; mode: string }
  | { kind: "partial"; duration: string }
  | { kind: "slur_start" }
  | { kind: "slur_end" }
  | { kind: "tie" }
  | { kind: "ornament"; name: "trill" | "mordent" | "turn" | "prall" }
  | { kind: "bar_check" }
  | { kind: "literal"; text: string; site: "before" | "after" };

// === Leaves ===

export type LyNote = {
  type: "note";
  pitch: string; // absolute LilyPond pitch: "d'", "ees", "a,,"
  duration: string; // "4", "8", "2.", "16"
  indicators: LyIndicator[];
};

export type LyChord = {
  type: "chord";
  pitches: string[]; // absolute LilyPond pitches
  duration: string;
  indicators: LyIndicator[];
};

export type LyRest = {
  type: "rest";
  duration: string;
  spacer: boolean; // true → "s" (invisible), false → "r"
  indicators: LyIndicator[];
};

export type LyLeaf = LyNote | LyChord | LyRest;

// === Containers ===

export type LyContextType =
  | "Score"
  | "Staff"
  | "TabStaff"
  | "RhythmicStaff"
  | "PianoStaff"
  | "ChoirStaff"
  | "Voice"
  | "Lyrics";

export type LyContainer = {
  type: "container";
  context: LyContextType;
  name?: string; // → = "name" in output
  simultaneous: boolean; // true → << >>, false → { }
  children: (LyLeaf | LyContainer)[];
  indicators: LyIndicator[]; // before-opening-brace indicators
  withBlock?: string[]; // → \with { line1 \n line2 ... }
  lyricsto?: string; // → \new Lyrics \lyricsto "voiceName" { ... }
};

// === Top-level file ===

export type LyVariable = {
  name: string;
  body: string;
  braces?: boolean; // true (default) → name = { body }, false → name = body
};

export type LyFile = {
  version: string; // "2.24.0"
  includes: string[]; // \include paths
  header?: Record<string, string>; // \header { title = "...", composer = "..." }
  variables?: LyVariable[]; // top-level variable definitions
  score: LyContainer; // the \score block
  layout: boolean; // emit \layout { }
  midi?: { tempo: number }; // emit \midi { \tempo 4 = N }
};

// === Helper constructors ===

/** Create a LyNote leaf. */
export function lyNote(pitch: string, duration: string, indicators: LyIndicator[] = []): LyNote {
  return { type: "note", pitch, duration, indicators };
}

/** Create a LyChord leaf. */
export function lyChord(
  pitches: string[],
  duration: string,
  indicators: LyIndicator[] = []
): LyChord {
  return { type: "chord", pitches, duration, indicators };
}

/** Create a LyRest leaf. */
export function lyRest(duration: string, spacer = false, indicators: LyIndicator[] = []): LyRest {
  return { type: "rest", duration, spacer, indicators };
}

/** Create a LyContainer (Voice, Staff, Score, etc.). */
export function lyContainer(
  context: LyContextType,
  opts: {
    name?: string;
    simultaneous?: boolean;
    children?: (LyLeaf | LyContainer)[];
    indicators?: LyIndicator[];
    withBlock?: string[];
    lyricsto?: string;
  } = {}
): LyContainer {
  return {
    type: "container",
    context,
    name: opts.name,
    simultaneous: opts.simultaneous ?? false,
    children: opts.children ?? [],
    indicators: opts.indicators ?? [],
    withBlock: opts.withBlock,
    lyricsto: opts.lyricsto,
  };
}

/** Shorthand: create a Voice container. */
export function lyVoice(
  name: string,
  children: (LyLeaf | LyContainer)[],
  opts: { indicators?: LyIndicator[] } = {}
): LyContainer {
  return lyContainer("Voice", {
    name,
    children,
    indicators: opts.indicators,
  });
}

/** Shorthand: create a Staff container. */
export function lyStaff(
  children: (LyLeaf | LyContainer)[],
  opts: {
    name?: string;
    simultaneous?: boolean;
    indicators?: LyIndicator[];
    withBlock?: string[];
  } = {}
): LyContainer {
  return lyContainer("Staff", {
    children,
    ...opts,
  });
}

/** Shorthand: create a TabStaff container. */
export function lyTabStaff(
  children: (LyLeaf | LyContainer)[],
  opts: {
    name?: string;
    withBlock?: string[];
    indicators?: LyIndicator[];
  } = {}
): LyContainer {
  return lyContainer("TabStaff", {
    children,
    ...opts,
  });
}

/** Shorthand: create a RhythmicStaff container. */
export function lyRhythmicStaff(
  children: (LyLeaf | LyContainer)[],
  opts: {
    indicators?: LyIndicator[];
    withBlock?: string[];
  } = {}
): LyContainer {
  return lyContainer("RhythmicStaff", {
    children,
    ...opts,
  });
}

/** Shorthand: create a Lyrics container with \lyricsto binding. */
export function lyLyrics(
  voiceName: string,
  children: (LyLeaf | LyContainer)[],
  opts: { indicators?: LyIndicator[] } = {}
): LyContainer {
  return lyContainer("Lyrics", {
    lyricsto: voiceName,
    children,
    indicators: opts.indicators,
  });
}

/** Shorthand: create a Score container. */
export function lyScore(
  children: (LyLeaf | LyContainer)[],
  opts: { simultaneous?: boolean } = {}
): LyContainer {
  return lyContainer("Score", {
    children,
    simultaneous: opts.simultaneous ?? true,
  });
}

// === Serializer ===

/** Serialize a complete LyFile to LilyPond source. */
export function serializeFile(file: LyFile): string {
  const lines: string[] = [];

  lines.push(`\\version "${file.version}"`);

  for (const inc of file.includes) {
    lines.push(`\\include "${inc}"`);
  }

  if (file.header && Object.keys(file.header).length > 0) {
    lines.push("");
    lines.push("\\header {");

    for (const [k, v] of Object.entries(file.header)) {
      lines.push(`  ${k} = "${v}"`);
    }

    lines.push("}");
  }

  if (file.variables && file.variables.length > 0) {
    lines.push("");

    for (const variable of file.variables) {
      if (variable.braces === false) {
        lines.push(`${variable.name} = ${variable.body}`);
      } else {
        lines.push(`${variable.name} = { ${variable.body} }`);
      }
    }
  }

  lines.push("");
  lines.push("\\score {");
  lines.push(serializeContainer(file.score, 1));

  if (file.layout) {
    lines.push("  \\layout { }");
  }

  if (file.midi) {
    lines.push(`  \\midi { \\tempo 4 = ${file.midi.tempo} }`);
  }

  lines.push("}");

  return lines.join("\n") + "\n";
}

/** Serialize a container node to indented LilyPond text. */
function serializeContainer(node: LyContainer, indent: number): string {
  const pad = "  ".repeat(indent);
  const open = node.simultaneous ? "<<" : "{";
  const close = node.simultaneous ? ">>" : "}";

  let out = `${pad}\\new ${node.context}`;

  if (node.lyricsto) {
    out += ` \\lyricsto "${node.lyricsto}"`;
  } else if (node.name) {
    out += ` = "${node.name}"`;
  }

  if (node.withBlock && node.withBlock.length > 0) {
    out += " \\with {\n";

    for (const entry of node.withBlock) {
      out += `${pad}  ${entry}\n`;
    }

    out += `${pad}}`;
  }

  out += ` ${open}\n`;

  // Container-level indicators (overrides, removes, etc.)
  for (const ind of node.indicators) {
    out += `${pad}  ${serializeIndicatorStandalone(ind)}\n`;
  }

  // Children
  for (const child of node.children) {
    if (child.type === "container") {
      out += serializeContainer(child, indent + 1) + "\n";
    } else {
      out += serializeLeaf(child, indent + 1) + "\n";
    }
  }

  out += `${pad}${close}`;

  return out;
}

/** Serialize a leaf node (note, chord, rest) to LilyPond text. */
function serializeLeaf(leaf: LyLeaf, indent: number): string {
  const pad = "  ".repeat(indent);
  let out = "";

  // Before-indicators on their own lines
  for (const ind of leaf.indicators) {
    if (ind.kind === "literal" && ind.site === "before") {
      out += `${pad}${ind.text}\n`;
    } else if (ind.kind === "time_signature") {
      out += `${pad}\\time ${ind.numerator}/${ind.denominator}\n`;
    } else if (ind.kind === "key_signature") {
      out += `${pad}\\key ${ind.tonic} \\${ind.mode}\n`;
    } else if (ind.kind === "partial") {
      out += `${pad}\\partial ${ind.duration}\n`;
    }
  }

  let core: string;

  switch (leaf.type) {
    case "note":
      core = `${leaf.pitch}${leaf.duration}`;
      break;
    case "chord":
      core = `<${leaf.pitches.join(" ")}>${leaf.duration}`;
      break;
    case "rest":
      core = `${leaf.spacer ? "s" : "r"}${leaf.duration}`;
      break;
  }

  let suffix = "";

  for (const ind of leaf.indicators) {
    if (ind.kind === "tie") suffix += "~";
    else if (ind.kind === "slur_start") suffix += "(";
    else if (ind.kind === "slur_end") suffix += ")";
    else if (ind.kind === "ornament") suffix += `\\${ind.name}`;
    else if (ind.kind === "bar_check") suffix += " |";
    else if (ind.kind === "literal" && ind.site === "after") suffix += ` ${ind.text}`;
  }

  out += `${pad}${core}${suffix}`;

  return out;
}

/** Serialize an indicator as a standalone line (for container-level indicators). */
function serializeIndicatorStandalone(ind: LyIndicator): string {
  switch (ind.kind) {
    case "time_signature":
      return `\\time ${ind.numerator}/${ind.denominator}`;
    case "key_signature":
      return `\\key ${ind.tonic} \\${ind.mode}`;
    case "partial":
      return `\\partial ${ind.duration}`;
    case "literal":
      return ind.text;
    case "bar_check":
      return "|";
    default:
      return "";
  }
}
