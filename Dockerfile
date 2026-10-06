# ============================================================
# CaptureWeb — full-stack screenshot capture service
# Frontend: React + Vite (built to dist/public)
# Backend:  Hono + tRPC (dist/boot.js) + capture-website (Puppeteer)
# Browser:  system Chromium (no Chrome download)
# ============================================================

# ---------- build stage ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Skip puppeteer's Chrome download — the runtime image ships system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Build frontend (dist/public) and bundle the API server (dist/boot.js)
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

# System Chromium + fonts for accurate rendering
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/.env ./.env

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/api/trpc/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/boot.js"]
