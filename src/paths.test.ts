import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["PROJECT_ROOT", "APP_DATA_ROOT", "APP_OUTPUT_ROOT"];

describe("paths", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("defaults state and output under the project root", async () => {
    process.env.PROJECT_ROOT = "/app";
    vi.resetModules();
    const paths = await import("./paths.js");
    expect(paths.projectRoot).toBe("/app");
    expect(paths.dataRoot).toBe("/app/data");
    expect(paths.outputRoot).toBe("/app/output/telegram-jobs");
    expect(paths.templatesRoot).toBe("/app/templates");
    expect(paths.sfxRoot).toBe("/app/assets/sfx");
  });

  it("allows Render to move state and outputs onto a persistent disk", async () => {
    process.env.PROJECT_ROOT = "/app";
    process.env.APP_DATA_ROOT = "/var/data/data";
    process.env.APP_OUTPUT_ROOT = "/var/data/output/telegram-jobs";
    vi.resetModules();
    const paths = await import("./paths.js");
    expect(paths.projectRoot).toBe("/app");
    expect(paths.dataRoot).toBe("/var/data/data");
    expect(paths.outputRoot).toBe("/var/data/output/telegram-jobs");
  });
});
