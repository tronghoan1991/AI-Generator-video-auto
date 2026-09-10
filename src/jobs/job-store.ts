import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dataRoot } from "../paths.js";
import { type JobDatabase, type JobRecord, type JobResultPaths, type JobStatistics } from "./job-types.js";

const EMPTY_DB: JobDatabase = { jobs: [] };

function nowIso(): string {
  return new Date().toISOString();
}

function durationSeconds(job: JobRecord): number {
  if (!job.startedAt || !job.finishedAt) return 0;
  return Math.max(0, (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) / 1000);
}

export class JobStore {
  constructor(private readonly filePath = join(dataRoot, "jobs.json")) {}

  private async load(): Promise<JobDatabase> {
    if (!existsSync(this.filePath)) {
      return { jobs: [] };
    }
    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<JobDatabase>;
    return { jobs: parsed.jobs ?? [] };
  }

  private async save(db: JobDatabase): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    await rename(tmpPath, this.filePath);
  }

  async enqueue(job: Omit<JobRecord, "status" | "requestedAt">): Promise<JobRecord> {
    const db = await this.load();
    const record: JobRecord = {
      ...job,
      status: "pending",
      requestedAt: nowIso(),
    };
    db.jobs.push(record);
    await this.save(db);
    return record;
  }

  async get(jobId: string): Promise<JobRecord | undefined> {
    const db = await this.load();
    return db.jobs.find((job) => job.id === jobId);
  }

  async listRecent(limit = 10): Promise<JobRecord[]> {
    const db = await this.load();
    return [...db.jobs]
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
      .slice(0, limit);
  }

  async listByStatuses(statuses: JobRecord["status"][]): Promise<JobRecord[]> {
    const db = await this.load();
    return db.jobs
      .filter((job) => statuses.includes(job.status))
      .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
  }

  async nextPending(): Promise<JobRecord | undefined> {
    const pending = await this.listByStatuses(["pending"]);
    return pending[0];
  }

  async markRunning(jobId: string, processId: number): Promise<JobRecord | undefined> {
    const db = await this.load();
    const job = db.jobs.find((entry) => entry.id === jobId);
    if (!job || job.status !== "pending") return job;
    job.status = "running";
    job.startedAt = nowIso();
    job.finishedAt = undefined;
    job.cancelledAt = undefined;
    job.lastError = undefined;
    job.processId = processId;
    await this.save(db);
    return job;
  }

  async markCompleted(jobId: string, result: JobResultPaths): Promise<JobRecord | undefined> {
    const db = await this.load();
    const job = db.jobs.find((entry) => entry.id === jobId);
    if (!job) return undefined;
    job.status = "completed";
    job.finishedAt = nowIso();
    job.processId = undefined;
    job.result = result;
    await this.save(db);
    return job;
  }

  async markFailed(jobId: string, error: string): Promise<JobRecord | undefined> {
    const db = await this.load();
    const job = db.jobs.find((entry) => entry.id === jobId);
    if (!job) return undefined;
    job.status = "failed";
    job.finishedAt = nowIso();
    job.processId = undefined;
    job.lastError = error;
    await this.save(db);
    return job;
  }

  async cancel(jobId: string, error = "Cancelled from Telegram"): Promise<JobRecord | undefined> {
    const db = await this.load();
    const job = db.jobs.find((entry) => entry.id === jobId);
    if (!job) return undefined;
    job.status = "cancelled";
    job.cancelledAt = nowIso();
    job.finishedAt = job.finishedAt ?? job.cancelledAt;
    job.processId = undefined;
    job.lastError = error;
    await this.save(db);
    return job;
  }

  async requeueRunningJobs(): Promise<number> {
    const db = await this.load();
    let count = 0;
    for (const job of db.jobs) {
      if (job.status !== "running") continue;
      job.status = "pending";
      job.processId = undefined;
      job.startedAt = undefined;
      job.finishedAt = undefined;
      job.lastError = "Worker restarted before the job finished; re-queued automatically.";
      count += 1;
    }
    if (count > 0) {
      await this.save(db);
    }
    return count;
  }

  async getStatistics(): Promise<JobStatistics> {
    const db = await this.load();
    const completed = db.jobs.filter((job) => job.status === "completed");
    const averageCompletedSeconds =
      completed.length === 0
        ? 0
        : completed.reduce((sum, job) => sum + durationSeconds(job), 0) / completed.length;

    return {
      total: db.jobs.length,
      pending: db.jobs.filter((job) => job.status === "pending").length,
      running: db.jobs.filter((job) => job.status === "running").length,
      completed: completed.length,
      failed: db.jobs.filter((job) => job.status === "failed").length,
      cancelled: db.jobs.filter((job) => job.status === "cancelled").length,
      averageCompletedSeconds,
    };
  }

  async getQueueSnapshot(): Promise<{ stats: JobStatistics; recentJobs: JobRecord[] }> {
    return {
      stats: await this.getStatistics(),
      recentJobs: await this.listRecent(5),
    };
  }
}

export { EMPTY_DB };
