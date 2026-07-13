import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("evaluation command contract", () => {
  it("declares every required machine-readable evaluation command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts)).toEqual(
      expect.arrayContaining([
        "eval:fast",
        "eval:golden",
        "eval:render",
        "eval:playback",
        "eval:omr",
        "eval:model",
        "eval:compare",
        "eval:report",
      ])
    );
    for (const name of Object.keys(packageJson.scripts).filter((name) =>
      name.startsWith("eval:")
    )) {
      expect(packageJson.scripts[name]).toMatch(/node dist-server\/server\/.+\.js/);
    }
  });
});
