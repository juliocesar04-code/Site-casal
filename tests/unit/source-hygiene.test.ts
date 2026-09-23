import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Invisible and bidirectional control characters make code read differently
// from what it does (Trojan Source). They must appear only as escapes.
const INVISIBLE = new RegExp(
  `[${[0x200b, 0xfeff, ...range(0x202a, 0x202e), ...range(0x2066, 0x2069)].map((code) => String.fromCharCode(code)).join("")}]`,
);

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("source hygiene", () => {
  it("has no literal invisible or bidi control characters", () => {
    const offenders = ["src", "tests", "supabase", "docs"]
      .flatMap(files)
      .filter((path) => INVISIBLE.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
