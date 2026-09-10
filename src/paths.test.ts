import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";

const ENV_KEYS = ["PROJECT_ROOT", "DATA_ROOT", "OUTPUT_ROOT", "ASSETS_ROOT", "TEMPLATES_ROOT"];

describe("paths", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    ENV_KEYS.forEach((key) => delete process.env[key]);
  });

  afterEach(() => {
    Object.entries(saved).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    vi.resetModules();
  });

  it("defaults storage and asset roots under projectRoot", async () => {
    const mod = await import("./paths.js");
    expect(mod.dataRoot).toBe(join(mod.projectRoot, "data"));
    expect(mod.outputRoot).toBe(join(mod.projectRoot, "output", "telegram-jobs"));
    expect(mod.assetsRoot).toBe(join(mod.projectRoot, "assets"));
    expect(mod.templatesRoot).toBe(join(mod.projectRoot, "templates"));
  });

  it("respects DATA_ROOT and OUTPUT_ROOT overrides for deploy persistence", async () => {
    process.env.DATA_ROOT = "/var/data/data";
    process.env.OUTPUT_ROOT = "/var/data/output/telegram-jobs";
    const mod = await import("./paths.js");
    expect(mod.dataRoot).toBe("/var/data/data");
    expect(mod.outputRoot).toBe("/var/data/output/telegram-jobs");
  });
});
