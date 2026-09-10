export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type JobSource = "telegram-upload" | "telegram-text" | "script-path";

export interface JobResultPaths {
  videoPath: string;
  audioPath: string;
  scriptTextPath: string;
}

export interface JobRecord {
  id: string;
  chatId: number;
  description: string;
  source: JobSource;
  scriptPath: string;
  outputDir: string;
  status: JobStatus;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  cancelledAt?: string;
  lastError?: string;
  processId?: number;
  result?: JobResultPaths;
}

export interface JobStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageCompletedSeconds: number;
}

export interface JobDatabase {
  jobs: JobRecord[];
}

export function createJobId(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `job-${stamp}-${rand}`;
}

export function isFinalStatus(status: JobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
