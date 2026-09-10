import { describe, expect, it } from "vitest";
import { workerCommandArgs } from "./job-runner.js";

describe("workerCommandArgs", () => {
  it("uses tsx + src cli when running from TypeScript sources", () => {
    const args = workerCommandArgs("/tmp/script.json", "/app/src/jobs/job-runner.ts");
    expect(args).toEqual(["--import", "tsx", "/app/src/cli.ts", "/tmp/script.json"]);
  });

  it("uses compiled dist cli when running from production build output", () => {
    const args = workerCommandArgs("/tmp/script.json", "/app/dist/jobs/job-runner.js");
    expect(args).toEqual(["/app/dist/cli.js", "/tmp/script.json"]);
  });
});
