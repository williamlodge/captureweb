# CaptureWeb

Full-stack web screenshot capture app built on top of
[sindresorhus/capture-website](https://github.com/sindresorhus/capture-website)
(headless Chromium via Puppeteer).

Paste a URL (or raw HTML), tune the capture options, and get a downloadable
screenshot or PDF — full page, device emulation, element clipping, custom
headers/cookies, dark mode, and more.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Hono + tRPC 11 (end-to-end typesafe), Zod input validation
- **Capture engine**: `capture-website` v5 + Puppeteer, concurrency-limited
  (2 parallel browser jobs) via `p-limit`
- **Deployment**: Docker (Node 20 + system Chromium, no Chrome download)

## Features

- URL or raw HTML input
- Output formats: PNG / JPEG / WebP / PDF (paper size, orientation,
  print backgrounds)
- Full-page capture, scale factor (retina), quality control
- Device presets (the library's full device list, served from the backend)
- Timing controls: delay, timeout, network idle, lazy-content preloading
- DOM selectors: element capture, wait/click/scroll-to, hide/remove elements
- Behavior: dark mode, ad blocking, animation disabling, JS toggle,
  fail-on-HTTP-error
- Identity: custom user agent, headers, cookies, HTTP basic auth
- Clip region (x/y/width/height)
- Terminal-style job log, live elapsed timer, recent-target history
  (browser-local)

## Develop

```bash
npm install
npm run dev        # http://localhost:3000 (Vite + Hono dev server)
```

Requires a Chromium binary. The backend resolves the browser from
`CHROMIUM_PATH` / `PUPPETEER_EXECUTABLE_PATH`, then falls back to common
system paths (`/usr/bin/chromium`, …).

## Build & run

```bash
npm run build      # frontend -> dist/public, API bundle -> dist/boot.js
npm start          # serves app + API on http://localhost:3000
```

## Docker

```bash
docker build -t captureweb .
docker run -p 3000:3000 captureweb
```

The Dockerfile uses a two-stage build and installs system Chromium in the
runtime image (`PUPPETEER_SKIP_DOWNLOAD=true`). `package-lock.json` is not
committed — builds use `npm install`; run `npm install` locally after
cloning to generate your own lockfile.

## API

The capture endpoint is a tRPC mutation: `capture.capture` (input validated
with Zod, returns base64 + metadata). `capture.devices` returns the list of
emulatable device names.

## Notes

- The Kimi-platform `.env` (app credentials, database URL) is gitignored —
  copy `.env.example` and fill in your own values when self-hosting.
- Recent-target history lives in `localStorage` only; nothing is persisted
  server-side.
