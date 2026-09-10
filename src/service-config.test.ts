import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadServiceConfig } from "./service-config.js";

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_OWNER_CHAT_ID",
  "HOST",
  "PORT",
  "WAKE_TOKEN",
  "WORKER_POLL_INTERVAL_MS",
];

describe("loadServiceConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.TELEGRAM_OWNER_CHAT_ID = "123";
  });

  afterEach(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("defaults host to 0.0.0.0 for container web deployments", () => {
    const cfg = loadServiceConfig();
    expect(cfg.httpHost).toBe("0.0.0.0");
    expect(cfg.httpPort).toBe(8080);
  });

  it("respects HOST and PORT overrides", () => {
    process.env.HOST = "127.0.0.1";
    process.env.PORT = "10000";
    const cfg = loadServiceConfig();
    expect(cfg.httpHost).toBe("127.0.0.1");
    expect(cfg.httpPort).toBe(10000);
  });
});
