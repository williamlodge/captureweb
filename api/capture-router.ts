import { existsSync } from "node:fs";
import { z } from "zod";
import pLimit from "p-limit";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import type { CaptureRequest, CaptureResult } from "@contracts/types";

// capture-website pulls in puppeteer; load it lazily so server boot stays fast
// and the module is only touched on first use.
type CaptureWebsite = typeof import("capture-website");
let captureModulePromise: Promise<CaptureWebsite> | null = null;
const loadCapture = (): Promise<CaptureWebsite> => {
  captureModulePromise ??= import("capture-website") as Promise<CaptureWebsite>;
  return captureModulePromise;
};

const MAX_CONCURRENT_CAPTURES = 2;
const captureLimit = pLimit(MAX_CONCURRENT_CAPTURES);

const MIME_BY_TYPE: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

const EXT_BY_TYPE: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  pdf: "pdf",
};

// Candidate Chromium locations: env override first, then common distro paths.
function resolveChromiumExecutable(): string | undefined {
  const fromEnv =
    process.env.CHROMIUM_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;

  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const pdfFormatSchema = z.enum([
  "letter",
  "legal",
  "tabloid",
  "ledger",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
]);

const captureInputSchema = z
  .object({
    input: z.string().min(1, "A URL or HTML content is required").max(500_000),
    inputType: z.enum(["url", "html"]).default("url"),
    width: z.number().int().min(100).max(7680).default(1280),
    height: z.number().int().min(100).max(7680).default(800),
    type: z.enum(["png", "jpeg", "webp", "pdf"]).default("png"),
    quality: z.number().min(0.05).max(1).default(1),
    scaleFactor: z.number().min(0.5).max(4).default(2),
    fullPage: z.boolean().default(false),
    emulateDevice: z.string().max(120).optional(),
    darkMode: z.boolean().default(false),
    delay: z.number().min(0).max(60).default(0),
    timeout: z.number().min(5).max(180).default(60),
    disableAnimations: z.boolean().default(false),
    blockAds: z.boolean().default(true),
    waitForNetworkIdle: z.boolean().default(false),
    preloadLazyContent: z.boolean().default(false),
    throwOnHttpError: z.boolean().default(false),
    isJavaScriptEnabled: z.boolean().default(true),
    element: z.string().max(500).optional(),
    waitForElement: z.string().max(500).optional(),
    clickElement: z.string().max(500).optional(),
    scrollToElement: z.string().max(500).optional(),
    hideElements: z.array(z.string().max(500)).max(50).optional(),
    removeElements: z.array(z.string().max(500)).max(50).optional(),
    userAgent: z.string().max(1000).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    cookies: z.array(z.string().max(4000)).max(50).optional(),
    authentication: z
      .object({ username: z.string().min(1), password: z.string().min(1) })
      .optional(),
    clip: z
      .object({
        x: z.number().min(0),
        y: z.number().min(0),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
    pdf: z
      .object({
        format: pdfFormatSchema.default("letter"),
        landscape: z.boolean().default(false),
        background: z.boolean().default(false),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.inputType === "url") {
      const raw = value.input.trim();
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;
      try {
        const url = new URL(withScheme);
        if (!/^https?:$/.test(url.protocol)) {
          ctx.addIssue({
            code: "custom",
            path: ["input"],
            message: "Only http:// and https:// URLs can be captured",
          });
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["input"],
          message: "Enter a valid URL (e.g. example.com)",
        });
      }
    }
    if (value.type === "pdf" && value.fullPage) {
      ctx.addIssue({
        code: "custom",
        path: ["fullPage"],
        message: "fullPage is not supported for PDF output",
      });
    }
    if (value.type === "pdf" && (value.clip || value.element)) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "clip and element are not supported for PDF output",
      });
    }
  });

function normalizeUrl(input: string): string {
  const raw = input.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function runCapture(request: CaptureRequest): Promise<CaptureResult> {
  const { default: captureWebsite } = await loadCapture();
  const executablePath = resolveChromiumExecutable();

  const startedAt = Date.now();
  let input: string = request.input;
  if (request.inputType === "url") {
    input = normalizeUrl(request.input);
  }

  const options: Record<string, unknown> = {
    inputType: request.inputType,
    width: request.width,
    height: request.height,
    type: request.type,
    quality: request.quality,
    scaleFactor: request.scaleFactor,
    fullPage: request.fullPage,
    darkMode: request.darkMode,
    delay: request.delay,
    timeout: request.timeout,
    disableAnimations: request.disableAnimations,
    blockAds: request.blockAds,
    waitForNetworkIdle: request.waitForNetworkIdle,
    preloadLazyContent: request.preloadLazyContent,
    throwOnHttpError: request.throwOnHttpError,
    isJavaScriptEnabled: request.isJavaScriptEnabled,
    launchOptions: {
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    },
  };

  if (request.emulateDevice) options.emulateDevice = request.emulateDevice;
  if (request.element) options.element = request.element;
  if (request.waitForElement) options.waitForElement = request.waitForElement;
  if (request.clickElement) options.clickElement = request.clickElement;
  if (request.scrollToElement)
    options.scrollToElement = request.scrollToElement;
  if (request.hideElements?.length) options.hideElements = request.hideElements;
  if (request.removeElements?.length)
    options.removeElements = request.removeElements;
  if (request.userAgent) options.userAgent = request.userAgent;
  if (request.headers && Object.keys(request.headers).length > 0)
    options.headers = request.headers;
  if (request.cookies?.length) options.cookies = request.cookies;
  if (request.authentication) options.authentication = request.authentication;
  if (request.clip) options.clip = request.clip;
  if (request.type === "pdf" && request.pdf) {
    options.pdf = {
      format: request.pdf.format,
      landscape: request.pdf.landscape,
      background: request.pdf.background,
    };
  }

  try {
    const buffer = await captureWebsite.buffer(
      input,
      options as never,
    );
    const durationMs = Date.now() - startedAt;
    return {
      base64: Buffer.from(buffer).toString("base64"),
      mimeType: MIME_BY_TYPE[request.type],
      extension: EXT_BY_TYPE[request.type],
      bytes: buffer.byteLength,
      durationMs,
      width: request.emulateDevice ? undefined : request.width,
      height: request.emulateDevice ? undefined : request.height,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Friendly, user-facing failure — puppeteer errors are long and noisy.
    const short = message.split("\n")[0].slice(0, 300);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Capture failed: ${short}`,
    });
  }
}

export const captureRouter = createRouter({
  devices: publicQuery.query(async () => {
    const mod = await loadCapture();
    return (mod.devices ?? []).slice().sort();
  }),

  capture: publicQuery
    .input(captureInputSchema)
    .mutation(async ({ input }) => {
      const result = await captureLimit(() =>
        runCapture(input as CaptureRequest),
      );
      return result;
    }),
});
