import { createServer } from "node:http";
import { URL } from "node:url";
import { JobRunner } from "./jobs/job-runner.js";
import { JobStore } from "./jobs/job-store.js";

export function startHttpServer(args: {
  host: string;
  port: number;
  wakeToken?: string;
  runner: JobRunner;
  store: JobStore;
}): void {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (url.pathname === "/healthz") {
      const snapshot = await args.store.getQueueSnapshot();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, runner: args.runner.getStatus(), ...snapshot }));
      return;
    }

    if (url.pathname === "/wake") {
      const providedToken = url.searchParams.get("token") ?? req.headers["x-wake-token"];
      if (args.wakeToken && providedToken !== args.wakeToken) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid token" }));
        return;
      }
      await args.runner.wake("http");
      const snapshot = await args.store.getQueueSnapshot();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, runner: args.runner.getStatus(), ...snapshot }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  });

  server.listen(args.port, args.host, () => {
    console.log(`HTTP control server listening on ${args.host}:${args.port}`);
  });
}
