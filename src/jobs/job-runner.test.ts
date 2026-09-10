import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPipelineCommandArgs } from "./job-runner.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function makeProjectRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "runner-root-"));
  tempDirs.push(dir);
  return dir;
}

describe("getPipelineCommandArgs", () => {
  it("uses built dist/cli.js when available", () => {
    const rootDir = makeProjectRoot();
    const distDir = join(rootDir, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "cli.js"), "console.log('ok')\n");
    expect(getPipelineCommandArgs(rootDir)).toEqual([join(rootDir, "dist", "cli.js")]);
  });

  it("falls back to tsx src/cli.ts when dist output is missing", () => {
    const rootDir = makeProjectRoot();
    expect(getPipelineCommandArgs(rootDir)).toEqual(["--import", "tsx", "src/cli.ts"]);
  });
});
