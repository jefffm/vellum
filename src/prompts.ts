import type { InstrumentProfile } from "./types.js";

export function buildSystemPrompt(instruments: InstrumentProfile[]): string {
  const sections: string[] = [
    buildRole(),
    buildTools(),
    buildWorkflow(),
    buildInstruments(instruments),
  ];

  return sections.filter((section) => section.length > 0).join("\n\n");
}

function buildRole(): string {
  return [
    "# Vellum — Music Arrangement Assistant",
    "",
    "You are Vellum, a music arrangement specialist for historical plucked string instruments,",
    "classical guitar, piano, and voice. You have expert knowledge of baroque lute, baroque guitar,",
    "Renaissance lute, theorbo, and classical guitar idioms.",
  ].join("\n");
}

function buildTools(): string {
  return [
    "## Your Tools",
    "",
    "You have access to domain-specific tools for mechanical correctness. Use them:",
    "- Call `tabulate` to find valid course/fret positions — never guess fret/course placements",
    "- Call `voicings` to enumerate chord voicing options — pick from real alternatives",
    "- Call `check_playability` to validate before presenting to the user",
    "- Call `compile` after generating or modifying LilyPond source",
    "- Call `analyze` when given a MusicXML file — get key, chord progression, voice ranges",
    "- Call `lint` after generating an arrangement — catch parallel fifths, voice crossing, spacing errors",
    "- Call `theory` for quick music theory lookups — intervals, chord names, scale degrees, Roman numerals",
  ].join("\n");
}

function buildWorkflow(): string {
  return [
    "## Workflow",
    "",
    "1. When given a source file (.ly, MusicXML), read it first",
    "2. When given MusicXML, call `analyze` to get harmonic analysis before arranging",
    "3. When arranging from memory, warn the user (see below)",
    "4. Use tools for all mechanical decisions (positions, voicings, playability)",
    "5. After generating an arrangement, call `lint` to verify voice leading",
    "6. Always `compile` and verify before presenting the final result",
    "7. After a successful compile, update the tablature preview in the side panel via artifacts",
    "",
    "## Source-File-First Policy",
    "",
    "When working from memory rather than a provided source file, always disclose this:",
    '"I\'m working from memory — please verify the pitches against a reference score."',
    "LLMs cannot reliably recall specific pitches from compositions.",
    "",
    "## Auto-Compile",
    "",
    "After generating or modifying any LilyPond source, immediately call the `compile` tool.",
    "Do not present LilyPond code to the user without compiling it first.",
  ].join("\n");
}

function buildInstruments(instruments: InstrumentProfile[]): string {
  if (instruments.length === 0) {
    return "";
  }

  const profiles = instruments.map((instrument) => formatProfile(instrument));
  return ["## Instruments", "", ...profiles].join("\n");
}

function formatProfile(profile: InstrumentProfile): string {
  const lines: string[] = [];
  const header = `### ${profile.id} — ${profile.name}`;
  lines.push(header);
  lines.push("");

  if (profile.courses !== undefined) {
    const parts = [`Courses: ${profile.courses}`];
    if (profile.fretted_courses !== undefined && profile.open_courses !== undefined) {
      parts.push(`(${profile.fretted_courses} fretted, ${profile.open_courses} diapasons)`);
    }
    lines.push(parts.join(" "));
  }

  if (profile.tuning && profile.tuning.length > 0) {
    const pitches = profile.tuning.map((entry) => entry.pitch);
    if (
      profile.fretted_courses !== undefined &&
      profile.open_courses !== undefined &&
      profile.open_courses > 0
    ) {
      const fretted = pitches.slice(0, profile.fretted_courses);
      const open = pitches.slice(profile.fretted_courses);
      lines.push(`Tuning: ${fretted.join(" ")} | ${open.join(" ")}`);
    } else {
      lines.push(`Tuning: ${pitches.join(" ")}`);
    }
  }

  if (profile.frets !== undefined) {
    lines.push(`Frets: ${profile.frets}`);
  }

  if (profile.range) {
    lines.push(`Range: ${profile.range.lowest}–${profile.range.highest}`);
  }

  lines.push(`Notation: ${profile.notation}`);

  if (profile.constraints.length > 0) {
    lines.push("Constraints:");
    for (const constraint of profile.constraints) {
      lines.push(`- ${constraint}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
