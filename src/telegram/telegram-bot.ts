import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { TemplateScriptSchema } from "../render/template-script-schema.js";
import { outputRoot, projectRoot } from "../paths.js";
import { log } from "../utils/logger.js";
import { JobRunner } from "../jobs/job-runner.js";
import { JobStore } from "../jobs/job-store.js";
import { createJobId, type JobRecord } from "../jobs/job-types.js";
import { cancelKeyboard, mainMenuKeyboard, managementKeyboard, recentJobsKeyboard } from "./inline-keyboards.js";
import { TelegramClient } from "./telegram-client.js";
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from "./telegram-types.js";

interface ChatSession {
  awaitingSubmission: boolean;
}

function formatJob(job: JobRecord): string {
  const lines = [
    `#${job.id}`,
    `Status: ${job.status}`,
    `Description: ${job.description}`,
    `Requested: ${job.requestedAt}`,
  ];

  if (job.startedAt) lines.push(`Started: ${job.startedAt}`);
  if (job.finishedAt) lines.push(`Finished: ${job.finishedAt}`);
  if (job.lastError) lines.push(`Error: ${job.lastError}`);
  if (job.result) {
    lines.push(`Video: ${job.result.videoPath}`);
    lines.push(`Audio: ${job.result.audioPath}`);
  }
  return lines.join("\n");
}

function formatStatistics(stats: Awaited<ReturnType<JobStore["getStatistics"]>>): string {
  return [
    "📊 Statistics",
    `Total: ${stats.total}`,
    `Pending: ${stats.pending}`,
    `Running: ${stats.running}`,
    `Completed: ${stats.completed}`,
    `Failed: ${stats.failed}`,
    `Cancelled: ${stats.cancelled}`,
    `Avg completed runtime: ${stats.averageCompletedSeconds.toFixed(1)}s`,
  ].join("\n");
}

function isInsideProject(candidate: string): boolean {
  return candidate === projectRoot || candidate.startsWith(`${projectRoot}${sep}`);
}

export class TelegramBot {
  private updateOffset = 0;
  private running = false;
  private readonly sessions = new Map<number, ChatSession>();

  constructor(
    public readonly client: TelegramClient,
    private readonly ownerChatId: number,
    private readonly store: JobStore,
    private readonly runner: JobRunner,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        const updates = await this.client.getUpdates(this.updateOffset, 20);
        for (const update of updates) {
          this.updateOffset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        log.error("Telegram polling failed", error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  async notifyJobEvent(event: "started" | "completed" | "failed" | "cancelled", job: JobRecord): Promise<void> {
    const prefix = {
      started: "🚀 Job started",
      completed: "✅ Job completed",
      failed: "❌ Job failed",
      cancelled: "🛑 Job cancelled",
    }[event];

    await this.client.sendMessage(job.chatId, `${prefix}\n\n${formatJob(job)}`, {
      reply_markup: mainMenuKeyboard(),
    });

    if (event === "completed" && job.result) {
      if (existsSync(job.result.videoPath)) {
        await this.client.sendDocument(job.chatId, job.result.videoPath, `Video for ${job.description}`);
      }
      if (existsSync(job.result.scriptTextPath)) {
        await this.client.sendDocument(job.chatId, job.result.scriptTextPath, `Script for ${job.description}`);
      }
    }
  }

  private session(chatId: number): ChatSession {
    const existing = this.sessions.get(chatId);
    if (existing) return existing;
    const created = { awaitingSubmission: false };
    this.sessions.set(chatId, created);
    return created;
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    }
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
    }
  }

  private authorized(chatId: number): boolean {
    return chatId === this.ownerChatId;
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    if (!this.authorized(chatId)) {
      await this.client.sendMessage(chatId, "This bot only accepts commands from the configured owner chat.");
      return;
    }

    const text = message.text?.trim() ?? message.caption?.trim() ?? "";
    if (text === "/start") {
      await this.sendStart(chatId);
      return;
    }
    if (text === "/wake") {
      await this.runner.wake("telegram-command");
      await this.client.sendMessage(chatId, "Worker woke up and checked the queue.", { reply_markup: mainMenuKeyboard() });
      return;
    }
    if (text === "/status") {
      await this.sendReport(chatId);
      return;
    }

    const session = this.session(chatId);
    if (session.awaitingSubmission) {
      await this.acceptSubmission(message);
      session.awaitingSubmission = false;
      return;
    }

    await this.client.sendMessage(
      chatId,
      "Use the inline keyboard to submit or manage jobs. Tap Start to reopen the main menu.",
      { reply_markup: mainMenuKeyboard() },
    );
  }

  private async handleCallback(query: TelegramCallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    if (!chatId || !this.authorized(chatId)) {
      await this.client.answerCallbackQuery(query.id, "Unauthorized chat");
      return;
    }

    const data = query.data ?? "";
    if (data === "menu:start") {
      await this.sendStart(chatId);
    } else if (data === "menu:management") {
      await this.client.sendMessage(chatId, "Management controls", { reply_markup: managementKeyboard() });
    } else if (data === "menu:video") {
      this.session(chatId).awaitingSubmission = true;
      await this.client.sendMessage(
        chatId,
        "Send one of these next: \n- a script.json file\n- raw script JSON text\n- an existing absolute or repo-relative script.json path",
        { reply_markup: managementKeyboard() },
      );
    } else if (data === "menu:report") {
      await this.sendReport(chatId);
    } else if (data === "menu:statistics") {
      const stats = await this.store.getStatistics();
      await this.client.sendMessage(chatId, formatStatistics(stats), { reply_markup: mainMenuKeyboard() });
    } else if (data === "menu:cancel") {
      const jobs = await this.store.listByStatuses(["pending", "running"]);
      const jobIds = jobs.map((job) => job.id);
      await this.client.sendMessage(
        chatId,
        jobIds.length === 0 ? "No pending or running jobs." : "Choose a job to cancel:",
        { reply_markup: cancelKeyboard(jobIds) },
      );
    } else if (data === "menu:wake") {
      await this.runner.wake("telegram-button");
      await this.client.sendMessage(chatId, "Worker woke up and checked the queue.", { reply_markup: mainMenuKeyboard() });
    } else if (data === "jobs:submit") {
      this.session(chatId).awaitingSubmission = true;
      await this.client.sendMessage(chatId, "Send script.json now (file, raw JSON, or existing path).", {
        reply_markup: managementKeyboard(),
      });
    } else if (data === "jobs:recent") {
      const recent = await this.store.listRecent(5);
      await this.client.sendMessage(
        chatId,
        recent.length === 0 ? "No jobs yet." : recent.map(formatJob).join("\n\n"),
        { reply_markup: recentJobsKeyboard(recent.map((job) => job.id)) },
      );
    } else if (data.startsWith("jobs:details:")) {
      const jobId = data.split(":").at(-1)!;
      const job = await this.store.get(jobId);
      await this.client.sendMessage(chatId, job ? formatJob(job) : `Job not found: ${jobId}`, {
        reply_markup: mainMenuKeyboard(),
      });
    } else if (data.startsWith("jobs:cancel:")) {
      const jobId = data.split(":").at(-1)!;
      const job = await this.runner.cancelJob(jobId);
      await this.client.sendMessage(chatId, job ? `Cancel requested for ${jobId}` : `Job not found: ${jobId}`, {
        reply_markup: mainMenuKeyboard(),
      });
    }

    await this.client.answerCallbackQuery(query.id);
  }

  private async sendStart(chatId: number): Promise<void> {
    await this.client.sendMessage(
      chatId,
      [
        "Telegram-first AI video generator is ready.",
        "",
        "Main controls:",
        "- Start",
        "- Management",
        "- Video",
        "- Report",
        "- Cancel",
        "- Statistics",
        "- Wake",
      ].join("\n"),
      { reply_markup: mainMenuKeyboard() },
    );
  }

  private async sendReport(chatId: number): Promise<void> {
    const { stats, recentJobs } = await this.store.getQueueSnapshot();
    const lines = [
      "📋 Queue report",
      `Pending: ${stats.pending}`,
      `Running: ${stats.running}`,
      `Completed: ${stats.completed}`,
      `Failed: ${stats.failed}`,
      "",
      recentJobs.length === 0 ? "No jobs yet." : "Recent jobs:",
      ...recentJobs.map((job) => `- ${job.id} · ${job.status} · ${job.description}`),
    ];
    await this.client.sendMessage(chatId, lines.join("\n"), { reply_markup: mainMenuKeyboard() });
  }

  private async acceptSubmission(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    try {
      const submission = await this.normalizeSubmission(message);
      const job = await this.store.enqueue(submission);
      await this.client.sendMessage(chatId, `Queued ${job.id} for ${job.description}`, { reply_markup: mainMenuKeyboard() });
      await this.runner.wake("telegram-submission");
    } catch (error) {
      await this.client.sendMessage(chatId, `Could not queue job: ${error instanceof Error ? error.message : String(error)}`, {
        reply_markup: mainMenuKeyboard(),
      });
    }
  }

  private async normalizeSubmission(message: TelegramMessage): Promise<Omit<JobRecord, "status" | "requestedAt">> {
    const chatId = message.chat.id;

    if (message.document) {
      if (!(message.document.file_name ?? "").toLowerCase().endsWith(".json")) {
        throw new Error("Only .json script uploads are supported.");
      }
      const buffer = await this.client.downloadFile(message.document.file_id);
      const parsed = TemplateScriptSchema.parse(JSON.parse(buffer.toString("utf8")));
      const jobId = createJobId();
      const jobDir = join(outputRoot, jobId);
      await mkdir(jobDir, { recursive: true });
      const scriptPath = join(jobDir, "script.json");
      await writeFile(scriptPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      return {
        id: jobId,
        chatId,
        description: parsed.metadata.title,
        outputDir: jobDir,
        scriptPath,
        source: "telegram-upload",
      };
    }

    const text = message.text?.trim();
    if (!text) {
      throw new Error("No submission payload received.");
    }

    if (text.startsWith("{")) {
      const parsed = TemplateScriptSchema.parse(JSON.parse(text));
      const jobId = createJobId();
      const jobDir = join(outputRoot, jobId);
      await mkdir(jobDir, { recursive: true });
      const scriptPath = join(jobDir, "script.json");
      await writeFile(scriptPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      return {
        id: jobId,
        chatId,
        description: parsed.metadata.title,
        outputDir: jobDir,
        scriptPath,
        source: "telegram-text",
      };
    }

    const candidate = resolve(projectRoot, text);
    if (!isInsideProject(candidate)) {
      throw new Error("Script path must stay inside the repository checkout.");
    }
    if (!existsSync(candidate)) {
      throw new Error(`Script path does not exist: ${candidate}`);
    }
    const parsed = TemplateScriptSchema.parse(JSON.parse(await readFile(candidate, "utf8")));
    return {
      id: createJobId(),
      chatId,
      description: parsed.metadata.title || basename(candidate),
      outputDir: dirname(candidate),
      scriptPath: candidate,
      source: "script-path",
    };
  }
}
