import "dotenv/config";

function intEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${name} must be an integer, got "${value}"`);
  }
  return parsed;
}

function requiredInt(name: string): number {
  const value = required(name);
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${name} must be an integer, got "${value}"`);
  }
  return parsed;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export interface ServiceConfig {
  telegramBotToken: string;
  telegramOwnerChatId: number;
  httpHost: string;
  httpPort: number;
  wakeToken?: string;
  workerPollIntervalMs: number;
}

export function loadServiceConfig(): ServiceConfig {
  return {
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    telegramOwnerChatId: requiredInt("TELEGRAM_OWNER_CHAT_ID"),
    httpHost: process.env.HOST?.trim() || "0.0.0.0",
    httpPort: intEnv("PORT", 8080),
    wakeToken: process.env.WAKE_TOKEN?.trim() || undefined,
    workerPollIntervalMs: intEnv("WORKER_POLL_INTERVAL_MS", 15000),
  };
}
