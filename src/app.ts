import { ensureAppDirectories } from "./paths.js";
import { JobRunner } from "./jobs/job-runner.js";
import { JobStore } from "./jobs/job-store.js";
import { loadServiceConfig } from "./service-config.js";
import { startHttpServer } from "./server.js";
import { TelegramBot } from "./telegram/telegram-bot.js";
import { TelegramClient } from "./telegram/telegram-client.js";
import { log } from "./utils/logger.js";

async function main(): Promise<void> {
  ensureAppDirectories();
  const config = loadServiceConfig();
  const store = new JobStore();
  const telegram = new TelegramClient(config.telegramBotToken);
  let bot: TelegramBot;

  const runner = new JobRunner(store, {
    pollIntervalMs: config.workerPollIntervalMs,
    onEvent: async (event, job) => {
      await bot.notifyJobEvent(event, job);
    },
  });

  bot = new TelegramBot(telegram, config.telegramOwnerChatId, store, runner);

  await runner.start();
  startHttpServer({
    port: config.httpPort,
    wakeToken: config.wakeToken,
    runner,
    store,
  });

  log.info("Telegram bot polling started");
  await bot.start();
}

main().catch((error) => {
  log.error("Application failed to start", error);
  process.exit(1);
});
