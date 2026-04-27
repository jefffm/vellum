import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixtureDir, loadFixture } from "./lib/fixtures.js";

const PROJECT_ROOT = process.cwd();
const FIXTURES_DIR = fixtureDir();
const OUTPUT_DIR = path.join(os.tmpdir(), "vellum-fixture-tests");

let lilypondAvailable = false;

beforeAll(() => {
  try {
    execFileSync("which", ["lilypond"], { stdio: "pipe" });
    lilypondAvailable = true;
  } catch {
    lilypondAvailable = false;
  }

  if (lilypondAvailable) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
});

afterAll(() => {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

type CompileResult = {
  exitCode: number;
  stderr: string;
  outputPrefix: string;
};

function compileFixture(fileName: string): CompileResult {
  const stem = path.basename(fileName, ".ly");
  const outputPrefix = path.join(OUTPUT_DIR, stem);
  const fixturePath = path.join(FIXTURES_DIR, fileName);

  try {
    execFileSync(
      "lilypond",
      [
        "--svg",
        "-I",
        path.resolve(PROJECT_ROOT, "instruments"),
        "-I",
        path.resolve(PROJECT_ROOT, "templates"),
        "-I",
        FIXTURES_DIR,
        "-o",
        outputPrefix,
        fixturePath,
      ],
      { cwd: PROJECT_ROOT, stdio: ["pipe", "pipe", "pipe"], timeout: 30_000 }
    );

    return { exitCode: 0, stderr: "", outputPrefix };
  } catch (error: unknown) {
    const execError = error as { status?: number; stderr?: Buffer };
    return {
      exitCode: execError.status ?? 1,
      stderr: execError.stderr?.toString() ?? "",
      outputPrefix,
    };
  }
}

describe("fixture files", () => {
  const lyFixtures = fs.existsSync(FIXTURES_DIR)
    ? fs
        .readdirSync(FIXTURES_DIR)
        .filter((file) => file.endsWith(".ly"))
        .sort()
    : [];
  const xmlFixtures = fs.existsSync(FIXTURES_DIR)
    ? fs
        .readdirSync(FIXTURES_DIR)
        .filter((file) => file.endsWith(".xml"))
        .sort()
    : [];

  const compileResults = new Map<string, CompileResult>();

  function resultFor(fileName: string): CompileResult {
    if (!compileResults.has(fileName)) {
      compileResults.set(fileName, compileFixture(fileName));
    }

    return compileResults.get(fileName)!;
  }

  for (const fixture of lyFixtures) {
    it(`${fixture} compiles with LilyPond`, () => {
      if (!lilypondAvailable) return;

      const result = resultFor(fixture);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(/error:/i.test(result.stderr), result.stderr).toBe(false);
    });

    it(`${fixture} produces non-empty SVG`, () => {
      if (!lilypondAvailable) return;

      const result = resultFor(fixture);
      const svgPath = `${result.outputPrefix}.svg`;

      expect(fs.existsSync(svgPath)).toBe(true);
      const svg = fs.readFileSync(svgPath, "utf8");
      expect(svg.length).toBeGreaterThan(0);
      expect(svg).toContain("<svg");
    });
  }

  for (const fixture of xmlFixtures) {
    it(`${fixture} is well-formed XML`, () => {
      expect(() => assertWellFormedXml(loadFixture(fixture))).not.toThrow();
    });
  }
});

function assertWellFormedXml(source: string): void {
  const stack: string[] = [];
  const withoutComments = source
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "");
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>/g;

  for (const match of withoutComments.matchAll(tagPattern)) {
    const token = match[0];
    const name = match[1];

    if (token.startsWith("</")) {
      const open = stack.pop();
      if (open !== name) {
        throw new Error(
          `XML closing tag mismatch: expected </${open ?? "none"}> but found </${name}>`
        );
      }
    } else if (!token.endsWith("/>")) {
      stack.push(name);
    }
  }

  if (stack.length > 0) {
    throw new Error(`XML has unclosed tags: ${stack.join(", ")}`);
  }
}
