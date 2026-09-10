import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "../paths.js";
import { log } from "../utils/logger.js";
import { JobStore } from "./job-store.js";
import { type JobRecord } from "./job-types.js";

export type JobEvent = "started" | "completed" | "failed" | "cancelled";

export interface JobRunnerOptions {
  pollIntervalMs: number;
  onEvent?: (event: JobEvent, job: JobRecord) => Promise<void> | void;
}

function tailLines(input: string, maxLines = 25): string {
  return input.trim().split(/\r?\n/).slice(-maxLines).join("\n");
}

export function workerCommandArgs(scriptPath: string, modulePath = fileURLToPath(import.meta.url)): string[] {
  const runtimeRoot = join(dirname(modulePath), "..");
  if (modulePath.endsWith(".ts")) {
    return ["--import", "tsx", join(runtimeRoot, "cli.ts"), scriptPath];
  }
  return [join(runtimeRoot, "cli.js"), scriptPath];
}

export class JobRunner {
  private timer?: NodeJS.Timeout;
  private processing = false;
  private currentJobId?: string;
  private currentChild?: ChildProcess;
  private cancelRequestedForJobId?: string;

  constructor(
    private readonly store: JobStore,
    private readonly options: JobRunnerOptions,
  ) {}

  async start(): Promise<void> {
    const requeued = await this.store.requeueRunningJobs();
    if (requeued > 0) {
      log.warn(`Re-queued ${requeued} interrupted job(s)`);
    }
    await this.wake("startup");
    this.timer = setInterval(() => {
      void this.wake("interval");
    }, this.options.pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  getStatus(): { processing: boolean; currentJobId?: string } {
    return {
      processing: this.processing,
      currentJobId: this.currentJobId,
    };
  }

  async wake(source: string): Promise<void> {
    log.info(`Worker wake requested (${source})`);
    if (this.processing) return;
    this.processing = true;
    try {
      while (true) {
        const next = await this.store.nextPending();
        if (!next) break;
        await this.runJob(next);
      }
    } finally {
      this.processing = false;
    }
  }

  async cancelJob(jobId: string): Promise<JobRecord | undefined> {
    if (this.currentJobId === jobId && this.currentChild) {
      this.cancelRequestedForJobId = jobId;
      this.currentChild.kill("SIGTERM");
      setTimeout(() => {
        if (this.currentJobId === jobId && this.currentChild) {
          this.currentChild.kill("SIGKILL");
        }
      }, 5000).unref();
      return this.store.get(jobId);
    }
    return this.store.cancel(jobId);
  }

  private async emitEvent(event: JobEvent, job: JobRecord): Promise<void> {
    try {
      await this.options.onEvent?.(event, job);
    } catch (error) {
      log.error(`Failed to emit job event ${event} for ${job.id}`, error);
    }
  }

  private async runJob(job: JobRecord): Promise<void> {
    const commandArgs = workerCommandArgs(job.scriptPath);
    const child = spawn(process.execPath, commandArgs, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const runningJob = await this.store.markRunning(job.id, child.pid ?? 0);
    if (!runningJob) {
      child.kill("SIGTERM");
      return;
    }

    this.currentJobId = job.id;
    this.currentChild = child;
    this.cancelRequestedForJobId = undefined;
    await this.emitEvent("started", runningJob);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => resolve({ code, signal }));
    }).catch(async (error) => {
      const failedJob = await this.store.markFailed(job.id, error instanceof Error ? error.message : String(error));
      if (failedJob) {
        await this.emitEvent("failed", failedJob);
      }
      return { code: 1, signal: null };
    });

    try {
      if (this.cancelRequestedForJobId === job.id) {
        const cancelled = await this.store.cancel(job.id);
        if (cancelled) {
          await this.emitEvent("cancelled", cancelled);
        }
        return;
      }

      if (exit.code === 0) {
        const result = {
          videoPath: join(job.outputDir, "video.mp4"),
          audioPath: join(job.outputDir, "voice.mp3"),
          scriptTextPath: join(job.outputDir, "script.txt"),
        };
        const missing = Object.values(result).filter((path) => !existsSync(path));
        if (missing.length > 0) {
          const failedJob = await this.store.markFailed(job.id, `Pipeline finished but missing outputs: ${missing.join(", ")}`);
          if (failedJob) {
            await this.emitEvent("failed", failedJob);
          }
          return;
        }
        const completed = await this.store.markCompleted(job.id, result);
        if (completed) {
          await this.emitEvent("completed", completed);
        }
        return;
      }

      const errorText = tailLines(`${stderr}\n${stdout}`) || `Process exited with code ${exit.code ?? "null"} signal ${exit.signal ?? "null"}`;
      const failedJob = await this.store.markFailed(job.id, errorText);
      if (failedJob) {
        await this.emitEvent("failed", failedJob);
      }
    } finally {
      this.currentChild = undefined;
      this.currentJobId = undefined;
      this.cancelRequestedForJobId = undefined;
    }
  }
}
