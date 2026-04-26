import type { InstrumentProfile, TabPosition, TuningEntry, Violation, Voicing } from "../types.js";
import { noteToMidi, parsePitch, transposeNote } from "./pitch.js";

export type PlayabilityResult = {
  ok: boolean;
  violations: Violation[];
};

export class InstrumentModel {
  private currentDiapasonScheme?: string;

  constructor(private readonly profile: InstrumentProfile) {
    this.currentDiapasonScheme = this.defaultDiapasonScheme();
  }

  positionsForPitch(pitch: string): TabPosition[] {
    const targetMidi = noteToMidi(pitch);
    const positions: TabPosition[] = [];

    for (const tuning of this.tuningEntries()) {
      const course = this.courseFromTuning(tuning);
      const openPitch = this.openPitchForCourse(course);
      const fret = targetMidi - noteToMidi(openPitch);

      if (this.isDiapason(course)) {
        if (fret === 0) {
          positions.push({ course, fret: 0, quality: "diapason" });
        }
        continue;
      }

      if (fret >= 0 && fret <= this.maxFrets()) {
        positions.push({ course, fret, quality: qualityForFret(fret) });
      }
    }

    return positions.sort((a, b) => a.course - b.course || a.fret - b.fret);
  }

  pitchAtPosition(course: number, fret: number): string {
    return this.soundingPitch(course, fret);
  }

  isFretted(course: number): boolean {
    this.assertValidCourse(course);
    return course <= this.frettedCourseCount();
  }

  isDiapason(course: number): boolean {
    return !this.isFretted(course);
  }

  isReentrant(course: number): boolean {
    return this.tuningForCourse(course).re_entrant === true;
  }

  soundingPitch(course: number, fret: number): string {
    this.assertValidCourse(course);

    if (fret < 0 || !Number.isInteger(fret)) {
      throw new Error(`Invalid fret: ${fret}`);
    }

    if (this.isDiapason(course) && fret !== 0) {
      throw new Error(`Course ${course} is a diapason and cannot be fretted`);
    }

    if (fret > this.maxFrets()) {
      throw new Error(`Fret ${fret} exceeds maximum fret ${this.maxFrets()}`);
    }

    return transposeNote(this.openPitchForCourse(course), fret);
  }

  maxStretch(): number {
    const explicit = this.profile.constraints
      .map((constraint) => constraint.match(/stretch:\s*~?(\d+)/i)?.[1])
      .find((value): value is string => value !== undefined);

    if (explicit) {
      return Number(explicit);
    }

    return this.courseCount() <= 5 ? 5 : 4;
  }

  maxFrets(): number {
    return this.profile.frets ?? 0;
  }

  courseCount(): number {
    return this.profile.courses ?? this.tuningEntries().length;
  }

  frettedCourseCount(): number {
    if (this.profile.fretted_courses !== undefined) {
      return this.profile.fretted_courses;
    }

    if (this.profile.open_courses !== undefined) {
      return this.courseCount() - this.profile.open_courses;
    }

    return this.courseCount();
  }

  voicingsForChord(pitches: string[], maxStretch = this.maxStretch()): Voicing[] {
    if (pitches.length === 0) {
      return [];
    }

    const positionSets = pitches.map((pitch) => this.positionsForPitch(pitch));

    if (positionSets.some((positions) => positions.length === 0)) {
      return [];
    }

    const voicings: Voicing[] = [];

    for (const positions of cartesianProduct(positionSets)) {
      const playability = this.isPlayable(positions, maxStretch);

      if (!playability.ok) {
        continue;
      }

      const stretch = fretSpan(positions);
      const openStrings = positions.filter((position) => position.fret === 0).length;
      const uniqueCourses = new Set(positions.map((position) => position.course)).size;

      voicings.push({
        positions,
        stretch,
        campanella_score: uniqueCourses + openStrings * 0.5,
        open_strings: openStrings,
      });
    }

    return voicings.sort(
      (a, b) =>
        a.stretch - b.stretch ||
        b.open_strings - a.open_strings ||
        b.campanella_score - a.campanella_score
    );
  }

  diapasonPitches(scheme?: string): Map<number, string> {
    const selectedScheme = scheme ?? this.currentDiapasonScheme;
    const courses = this.diapasonCourses();
    const result = new Map<number, string>();

    if (courses.length === 0) {
      return result;
    }

    const pitches = selectedScheme ? this.profile.diapason_schemes?.[selectedScheme] : undefined;

    for (const [index, course] of courses.entries()) {
      const basePitch = this.tuningForCourse(course).note;

      if (pitches?.[index]) {
        result.set(course, withOctave(pitches[index], parsePitch(basePitch).octave));
      } else {
        result.set(course, basePitch);
      }
    }

    return result;
  }

  setDiapasonScheme(key: string): void {
    if (!this.profile.diapason_schemes?.[key]) {
      throw new Error(`Unknown diapason scheme: ${key}`);
    }

    this.currentDiapasonScheme = key;
  }

  distanceBetween(pos1: TabPosition, pos2: TabPosition): number {
    return Math.abs(pos1.fret - pos2.fret);
  }

  isPlayable(positions: TabPosition[], maxStretch = this.maxStretch()): PlayabilityResult {
    const violations: Violation[] = [];
    const courses = new Set<number>();

    for (const position of positions) {
      if (courses.has(position.course)) {
        violations.push({
          bar: 0,
          type: "same_course",
          description: `Multiple notes assigned to course ${position.course}`,
        });
      }
      courses.add(position.course);

      if (this.isDiapason(position.course) && position.fret !== 0) {
        violations.push({
          bar: 0,
          type: "out_of_range",
          description: `Course ${position.course} is a diapason and cannot be fretted`,
        });
      }
    }

    const stretch = fretSpan(positions);
    if (stretch > maxStretch) {
      violations.push({
        bar: 0,
        type: "stretch",
        description: `Fret span ${stretch} exceeds maximum stretch ${maxStretch}`,
      });
    }

    return { ok: violations.length === 0, violations };
  }

  static fromProfile(profile: InstrumentProfile): InstrumentModel {
    return new InstrumentModel(profile);
  }

  static async load(id: string): Promise<InstrumentModel> {
    const { loadProfile } = await import("../server/profiles.js");
    return new InstrumentModel(loadProfile(id));
  }

  private tuningEntries(): TuningEntry[] {
    return this.profile.tuning ?? [];
  }

  private tuningForCourse(course: number): TuningEntry {
    this.assertValidCourse(course);
    const tuning = this.tuningEntries().find((entry) => entry.course === course);

    if (!tuning) {
      throw new Error(`No tuning entry for course ${course}`);
    }

    return tuning;
  }

  private courseFromTuning(tuning: TuningEntry): number {
    if (tuning.course === undefined) {
      throw new Error("Tuning entry is missing course number");
    }

    return tuning.course;
  }

  private openPitchForCourse(course: number): string {
    return this.diapasonPitches().get(course) ?? this.tuningForCourse(course).note;
  }

  private diapasonCourses(): number[] {
    return this.tuningEntries()
      .map((entry) => this.courseFromTuning(entry))
      .filter((course) => !this.isFretted(course));
  }

  private defaultDiapasonScheme(): string | undefined {
    const schemes = this.profile.diapason_schemes;
    return schemes ? Object.keys(schemes)[0] : undefined;
  }

  private assertValidCourse(course: number): void {
    if (!Number.isInteger(course) || course < 1 || course > this.courseCount()) {
      throw new Error(`Invalid course: ${course}`);
    }
  }
}

function qualityForFret(fret: number): TabPosition["quality"] {
  if (fret === 0) return "open";
  return fret <= 4 ? "low_fret" : "high_fret";
}

function fretSpan(positions: TabPosition[]): number {
  const frettedPositions = positions.filter((position) => position.fret > 0);

  if (frettedPositions.length <= 1) {
    return 0;
  }

  const frets = frettedPositions.map((position) => position.fret);
  return Math.max(...frets) - Math.min(...frets);
}

function cartesianProduct<T>(sets: T[][]): T[][] {
  return sets.reduce<T[][]>(
    (accumulator, set) => accumulator.flatMap((items) => set.map((item) => [...items, item])),
    [[]]
  );
}

function withOctave(pitchClass: string, octave: number): string {
  return `${pitchClass}${octave}`;
}
