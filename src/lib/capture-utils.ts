import type { CaptureRequest } from "@contracts/types";

export interface FormState {
  input: string;
  inputType: "url" | "html";
  type: "png" | "jpeg" | "webp" | "pdf";
  width: number;
  height: number;
  fullPage: boolean;
  emulateDevice: string;
  scaleFactor: number;
  quality: number;
  delay: number;
  timeout: number;
  darkMode: boolean;
  disableAnimations: boolean;
  blockAds: boolean;
  waitForNetworkIdle: boolean;
  preloadLazyContent: boolean;
  throwOnHttpError: boolean;
  isJavaScriptEnabled: boolean;
  element: string;
  waitForElement: string;
  clickElement: string;
  scrollToElement: string;
  hideElements: string;
  removeElements: string;
  userAgent: string;
  headersText: string;
  cookiesText: string;
  authUser: string;
  authPass: string;
  clipEnabled: boolean;
  clipX: number;
  clipY: number;
  clipW: number;
  clipH: number;
  pdfFormat: string;
  pdfLandscape: boolean;
  pdfBackground: boolean;
}

export const defaultForm: FormState = {
  input: "",
  inputType: "url",
  type: "png",
  width: 1280,
  height: 800,
  fullPage: false,
  emulateDevice: "",
  scaleFactor: 2,
  quality: 1,
  delay: 0,
  timeout: 60,
  darkMode: false,
  disableAnimations: false,
  blockAds: true,
  waitForNetworkIdle: false,
  preloadLazyContent: false,
  throwOnHttpError: false,
  isJavaScriptEnabled: true,
  element: "",
  waitForElement: "",
  clickElement: "",
  scrollToElement: "",
  hideElements: "",
  removeElements: "",
  userAgent: "",
  headersText: "",
  cookiesText: "",
  authUser: "",
  authPass: "",
  clipEnabled: false,
  clipX: 0,
  clipY: 0,
  clipW: 800,
  clipH: 600,
  pdfFormat: "letter",
  pdfLandscape: false,
  pdfBackground: false,
};

function commaList(value: string): string[] | undefined {
  const items = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function lineList(value: string): string[] | undefined {
  const items = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseHeaders(text: string): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx > 0) {
      headers[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function buildCaptureRequest(form: FormState): CaptureRequest {
  const request: CaptureRequest = {
    input: form.input.trim(),
    inputType: form.inputType,
    width: form.width,
    height: form.height,
    type: form.type,
    quality: form.quality,
    scaleFactor: form.scaleFactor,
    fullPage: form.type === "pdf" ? false : form.fullPage,
    darkMode: form.darkMode,
    delay: form.delay,
    timeout: form.timeout,
    disableAnimations: form.disableAnimations,
    blockAds: form.blockAds,
    waitForNetworkIdle: form.waitForNetworkIdle,
    preloadLazyContent: form.preloadLazyContent,
    throwOnHttpError: form.throwOnHttpError,
    isJavaScriptEnabled: form.isJavaScriptEnabled,
  };

  if (form.emulateDevice) request.emulateDevice = form.emulateDevice;
  if (form.element.trim()) request.element = form.element.trim();
  if (form.waitForElement.trim())
    request.waitForElement = form.waitForElement.trim();
  if (form.clickElement.trim())
    request.clickElement = form.clickElement.trim();
  if (form.scrollToElement.trim())
    request.scrollToElement = form.scrollToElement.trim();

  const hide = commaList(form.hideElements);
  if (hide) request.hideElements = hide;
  const remove = commaList(form.removeElements);
  if (remove) request.removeElements = remove;

  if (form.userAgent.trim()) request.userAgent = form.userAgent.trim();

  const headers = parseHeaders(form.headersText);
  if (headers) request.headers = headers;

  const cookies = lineList(form.cookiesText);
  if (cookies) request.cookies = cookies;

  if (form.authUser.trim() && form.authPass) {
    request.authentication = {
      username: form.authUser.trim(),
      password: form.authPass,
    };
  }

  if (form.clipEnabled && form.type !== "pdf") {
    request.clip = {
      x: form.clipX,
      y: form.clipY,
      width: form.clipW,
      height: form.clipH,
    };
  }

  if (form.type === "pdf") {
    request.pdf = {
      format: form.pdfFormat as NonNullable<CaptureRequest["pdf"]>["format"],
      landscape: form.pdfLandscape,
      background: form.pdfBackground,
    };
  }

  return request;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function suggestFilename(form: FormState): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .slice(0, 19);
  let host = "capture";
  if (form.inputType === "url") {
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(form.input.trim())
        ? form.input.trim()
        : `https://${form.input.trim()}`;
      host = new URL(withScheme).hostname.replace(/[^a-z0-9.-]+/gi, "_");
    } catch {
      // fall back to generic name
    }
  } else {
    host = "html";
  }
  return `${host}-${stamp}.${form.type === "jpeg" ? "jpg" : form.type}`;
}

export interface HistoryEntry {
  input: string;
  type: string;
  ts: number;
  bytes: number;
}

const HISTORY_KEY = "captureweb-history";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.input !== entry.input)].slice(0, 8);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // storage full or unavailable — history is best-effort
  }
  return next;
}
