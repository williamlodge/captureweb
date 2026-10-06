// Shared types between frontend and backend (contracts/)

export interface CapturePdfOptions {
  format:
    | "letter"
    | "legal"
    | "tabloid"
    | "ledger"
    | "a0"
    | "a1"
    | "a2"
    | "a3"
    | "a4"
    | "a5"
    | "a6";
  landscape: boolean;
  background: boolean;
}

export interface CaptureClip {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureRequest {
  input: string;
  inputType: "url" | "html";
  width: number;
  height: number;
  type: "png" | "jpeg" | "webp" | "pdf";
  quality: number;
  scaleFactor: number;
  fullPage: boolean;
  emulateDevice?: string;
  darkMode: boolean;
  delay: number;
  timeout: number;
  disableAnimations: boolean;
  blockAds: boolean;
  waitForNetworkIdle: boolean;
  preloadLazyContent: boolean;
  throwOnHttpError: boolean;
  isJavaScriptEnabled: boolean;
  element?: string;
  waitForElement?: string;
  clickElement?: string;
  scrollToElement?: string;
  hideElements?: string[];
  removeElements?: string[];
  userAgent?: string;
  headers?: Record<string, string>;
  cookies?: string[];
  authentication?: { username: string; password: string };
  clip?: CaptureClip;
  pdf?: CapturePdfOptions;
}

export interface CaptureResult {
  base64: string;
  mimeType: string;
  extension: string;
  bytes: number;
  durationMs: number;
  width?: number;
  height?: number;
}
