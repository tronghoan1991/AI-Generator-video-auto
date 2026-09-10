import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, afterEach } from "vitest";
import { JobStore } from "./job-store.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

function createStore(): JobStore {
  const dir = mkdtempSync(join(tmpdir(), "job-store-"));
  dirs.push(dir);
  return new JobStore(join(dir, "jobs.json"));
}

describe("JobStore", () => {
  it("stores queued jobs and computes statistics", async () => {
    const store = createStore();
    const first = await store.enqueue({
      id: "job-1",
      chatId: 1,
      description: "First",
      outputDir: "/tmp/out1",
      scriptPath: "/tmp/out1/script.json",
      source: "telegram-text",
    });
    const second = await store.enqueue({
      id: "job-2",
      chatId: 1,
      description: "Second",
      outputDir: "/tmp/out2",
      scriptPath: "/tmp/out2/script.json",
      source: "script-path",
    });

    expect((await store.nextPending())?.id).toBe(first.id);

    await store.markRunning(first.id, 123);
    await store.markCompleted(first.id, {
      videoPath: "/tmp/out1/video.mp4",
      audioPath: "/tmp/out1/voice.mp3",
      scriptTextPath: "/tmp/out1/script.txt",
    });
    await store.cancel(second.id, "cancelled");

    const stats = await store.getStatistics();
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.pending).toBe(0);
  });

  it("re-queues interrupted running jobs on restart", async () => {
    const store = createStore();
    const job = await store.enqueue({
      id: "job-1",
      chatId: 1,
      description: "First",
      outputDir: "/tmp/out1",
      scriptPath: "/tmp/out1/script.json",
      source: "telegram-upload",
    });

    await store.markRunning(job.id, 999);
    const count = await store.requeueRunningJobs();
    const requeued = await store.get(job.id);

    expect(count).toBe(1);
    expect(requeued?.status).toBe("pending");
    expect(requeued?.lastError).toMatch(/re-queued/i);
  });
});
