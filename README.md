# AI-Generator-video-auto

Telegram-first AI video generation for `tronghoan1991/AI-Generator-video-auto`, built from the MIT-licensed `huytranvan2010/AI-auto-generate-video` pipeline.

## What this repository now includes

- The original deterministic video pipeline structure and utilities:
  - HyperFrames template rendering
  - OmniVoice TTS integration
  - SFX download/filter helpers
  - template catalog and reusable templates
- A Telegram-first control plane:
  - inline keyboard main UX
  - job submission from Telegram
  - queue + lifecycle persistence
  - job start/completion/failure/cancel notifications
  - reports, recent jobs, and statistics
  - worker wake/check controls from Telegram
- HTTP endpoints for operations:
  - `GET /healthz`
  - `GET|POST /wake?token=...`

## Telegram UX

Primary inline keyboard buttons:

- `▶️ Start`
- `🎛 Management`
- `🎬 Video`
- `📋 Report`
- `❌ Cancel`
- `📊 Statistics`
- `⚡ Wake`

### How job submission works

From Telegram, the owner can queue a render by sending one of the following after tapping **Video** or **Submit job**:

1. a `script.json` file
2. raw `script.json` text
3. an existing repo-local `script.json` path

The bot validates the script against the existing template schema, stores/queues the job, wakes the worker, and reports status back in Telegram.

## Job lifecycle

Jobs are persisted in `data/jobs.json` and move through:

`pending -> running -> completed | failed | cancelled`

Rendered outputs for Telegram-submitted jobs are stored under:

```text
output/telegram-jobs/<job-id>/
```

## HTTP control plane

### Health

```bash
curl http://127.0.0.1:8080/healthz
```

### Wake

```bash
curl "http://127.0.0.1:8080/wake?token=<WAKE_TOKEN>"
```

This is suitable for Cloud Scheduler or any cron-style ping service.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run start
```

The bot process runs:

- Telegram long polling
- the in-process queue worker
- the health / wake HTTP server

### Existing manual pipeline still works

```bash
npm run pipeline -- /absolute/path/to/script.json
```

## Required environment

```env
TTS_PROVIDER=omnivoice
OMNIVOICE_ENDPOINT=http://127.0.0.1:8123
TELEGRAM_BOT_TOKEN=...
TELEGRAM_OWNER_CHAT_ID=123456789
PORT=8080
WAKE_TOKEN=...
WORKER_POLL_INTERVAL_MS=15000
```

## Lowest-friction Google Cloud deployment

For this Telegram-first workflow, the simplest low-cost deployment is a **single persistent Google Compute Engine VM**.

Recommended practical setup:

1. Create one small Ubuntu VM.
2. Install Node.js, Chromium, FFmpeg/ffprobe, and your OmniVoice service.
3. Clone this repository on the VM.
4. Set `.env.local`.
5. Run the app with a process manager such as `systemd`.
6. Add a Cloud Scheduler job that pings `/wake`.

Why this is the best fit here:

- avoids Colab reconnect/redeploy delays
- keeps Chromium/template caches warm
- lets Telegram remain the only operator UI
- supports longer renders better than short-lived serverless jobs

## Scripts

- `npm run start` — Telegram bot + worker + HTTP control server
- `npm run pipeline -- <script.json>` — existing direct pipeline entrypoint
- `npm test` — focused unit tests
- `npm run typecheck`
- `npm run build`
- `npm run sfx:download`
- `npm run sfx:filter`

## License

MIT. Preserve the existing MIT licensing when reusing or extending the reference pipeline and templates.
