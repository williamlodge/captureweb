import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Clock3,
  Download,
  FileText,
  Github,
  Globe,
  History,
  Loader2,
  MonitorPlay,
  Crosshair,
  Image as ImageIcon,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/providers/trpc";
import type { CaptureResult } from "@contracts/types";
import {
  buildCaptureRequest,
  defaultForm,
  formatBytes,
  loadHistory,
  pushHistory,
  suggestFilename,
  type FormState,
  type HistoryEntry,
} from "@/lib/capture-utils";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="font-mono text-[10px] text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-left transition-colors hover:border-primary/40 disabled:opacity-40"
    >
      <span className="font-mono text-xs text-foreground/90">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="pointer-events-none"
      />
    </button>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-primary">[{index}]</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/80">
        {title}
      </span>
      <Separator className="flex-1 bg-border/60" />
    </div>
  );
}

const LOG_IDLE = "$ awaiting target …";
const LOG_QUEUED = "$ job queued — waiting for a free browser slot";
// Radix Select items cannot use an empty string as a value — sentinel instead
const CUSTOM_DEVICE = "__custom";

export default function Home() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [log, setLog] = useState(LOG_IDLE);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const devicesQuery = trpc.capture.devices.useQuery();
  const pingQuery = trpc.ping.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const capture = trpc.capture.capture.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setLog(`$ done in ${(data.durationMs / 1000).toFixed(1)}s — ${formatBytes(data.bytes)} captured`);
      setHistory(
        pushHistory({
          input: form.input.trim(),
          type: form.type,
          ts: Date.now(),
          bytes: data.bytes,
        }),
      );
      toast.success("Capture complete", {
        description: `${formatBytes(data.bytes)} in ${(data.durationMs / 1000).toFixed(1)}s`,
      });
    },
    onError: (error) => {
      setLog(`$ ERR ${error.message}`);
      toast.error("Capture failed", { description: error.message });
    },
  });

  useEffect(() => {
    if (!capture.isPending) return;
    const interval = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [capture.isPending]);

  const isPending = capture.isPending;

  const onSubmit = () => {
    if (!form.input.trim()) {
      toast.error("Enter a URL or HTML first");
      return;
    }
    if (form.type === "pdf" && form.fullPage) {
      toast.error("Full-page capture is not supported for PDF output");
      return;
    }
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setLog(LOG_QUEUED);
    setResult(null);
    capture.mutate(buildCaptureRequest(form));
  };

  const dataUrl = useMemo(
    () =>
      result ? `data:${result.mimeType};base64,${result.base64}` : null,
    [result],
  );

  const onDownload = () => {
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = suggestFilename(form);
    anchor.click();
  };

  const engineOnline = pingQuery.data?.ok === true;
  const deviceSelected = form.emulateDevice !== "";

  return (
    <div className="scanline min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/50 bg-primary/10">
              <Camera className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold tracking-[0.25em] text-foreground glow-text">
                CAPTURE<span className="text-primary">//</span>WEB
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                headless chromium · capture-website engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden gap-1.5 border-border/70 font-mono text-[10px] sm:flex"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${engineOnline ? "bg-primary shadow-[0_0_6px_hsl(84_81%_44%)]" : "bg-destructive"}`}
              />
              {engineOnline ? "ENGINE ONLINE" : "ENGINE ?"}
            </Badge>
            <Button asChild variant="ghost" size="sm" className="gap-2 font-mono text-xs">
              <a
                href="https://github.com/sindresorhus/capture-website"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">sindresorhus/capture-website</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[440px_1fr]">
        {/* ===================== CONTROL CONSOLE ===================== */}
        <section className="space-y-4 rounded-lg border border-border/70 bg-card/70 p-4 backdrop-blur">
          <SectionTitle index="01" title="Target" />
          <Field label="Input type">
            <div className="grid grid-cols-2 gap-2">
              {(["url", "html"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("inputType", mode)}
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    form.inputType === mode
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {mode === "url" ? <Globe className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {mode}
                </button>
              ))}
            </div>
          </Field>

          {form.inputType === "url" ? (
            <Field label="URL" hint="scheme optional — https:// is assumed">
              <Input
                value={form.input}
                onChange={(event) => set("input", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSubmit();
                }}
                placeholder="example.com"
                className="font-mono text-sm"
                spellCheck={false}
              />
            </Field>
          ) : (
            <Field label="HTML source">
              <Textarea
                value={form.input}
                onChange={(event) => set("input", event.target.value)}
                placeholder="<h1>Hello, world</h1>"
                className="min-h-28 font-mono text-xs"
                spellCheck={false}
              />
            </Field>
          )}

          {history.length > 0 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" /> Recent targets
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {history.map((entry) => (
                  <button
                    key={`${entry.input}-${entry.ts}`}
                    type="button"
                    onClick={() => {
                      set("input", entry.input);
                      set("inputType", entry.input.startsWith("<") ? "html" : "url");
                    }}
                    className="max-w-full truncate rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    title={entry.input}
                  >
                    {entry.input.length > 34 ? `${entry.input.slice(0, 34)}…` : entry.input}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SectionTitle index="02" title="Output" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select value={form.type} onValueChange={(v) => set("type", v as FormState["type"])}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Scale factor">
              <Select
                value={String(form.scaleFactor)}
                onValueChange={(v) => set("scaleFactor", Number(v))}
              >
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x retina</SelectItem>
                  <SelectItem value="3">3x</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {(form.type === "jpeg" || form.type === "webp") && (
            <Field label={`Quality — ${Math.round(form.quality * 100)}%`}>
              <Slider
                value={[form.quality]}
                onValueChange={([v]) => set("quality", v)}
                min={0.05}
                max={1}
                step={0.05}
              />
            </Field>
          )}

          <Toggle
            label="Full page (entire scroll height)"
            checked={form.fullPage}
            onChange={(v) => set("fullPage", v)}
            disabled={form.type === "pdf"}
          />

          <SectionTitle index="03" title="Viewport" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Width px">
              <Input
                type="number"
                min={100}
                max={7680}
                value={form.width}
                disabled={deviceSelected}
                onChange={(event) => set("width", Number(event.target.value) || 1280)}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Height px">
              <Input
                type="number"
                min={100}
                max={7680}
                value={form.height}
                disabled={deviceSelected}
                onChange={(event) => set("height", Number(event.target.value) || 800)}
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <Field label="Device preset" hint="overrides width / height / dpr">
            <Select
              value={form.emulateDevice || CUSTOM_DEVICE}
              onValueChange={(v) =>
                set("emulateDevice", v === CUSTOM_DEVICE ? "" : v)
              }
            >
              <SelectTrigger className="font-mono text-xs">
                <SelectValue placeholder="Custom viewport" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={CUSTOM_DEVICE}>Custom viewport</SelectItem>
                {(devicesQuery.data ?? []).map((device) => (
                  <SelectItem key={device} value={device}>
                    {device}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <SectionTitle index="04" title="Timing" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delay s" hint="after load">
              <Input
                type="number"
                min={0}
                max={60}
                value={form.delay}
                onChange={(event) => set("delay", Number(event.target.value) || 0)}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Timeout s">
              <Input
                type="number"
                min={5}
                max={180}
                value={form.timeout}
                onChange={(event) => set("timeout", Number(event.target.value) || 60)}
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <Toggle
            label="Wait for network idle"
            checked={form.waitForNetworkIdle}
            onChange={(v) => set("waitForNetworkIdle", v)}
          />
          <Toggle
            label="Preload lazy content (scroll page)"
            checked={form.preloadLazyContent}
            onChange={(v) => set("preloadLazyContent", v)}
          />

          <SectionTitle index="05" title="Advanced" />
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="selectors" className="border-border/60">
              <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground/80 hover:no-underline">
                <span className="flex items-center gap-2">
                  <Crosshair className="h-3.5 w-3.5 text-primary" /> DOM selectors
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Field label="Capture element">
                  <Input
                    value={form.element}
                    onChange={(event) => set("element", event.target.value)}
                    placeholder=".hero, #main…"
                    disabled={form.type === "pdf"}
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Wait for element">
                    <Input
                      value={form.waitForElement}
                      onChange={(event) => set("waitForElement", event.target.value)}
                      className="font-mono text-xs"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Click element">
                    <Input
                      value={form.clickElement}
                      onChange={(event) => set("clickElement", event.target.value)}
                      className="font-mono text-xs"
                      spellCheck={false}
                    />
                  </Field>
                </div>
                <Field label="Scroll to element">
                  <Input
                    value={form.scrollToElement}
                    onChange={(event) => set("scrollToElement", event.target.value)}
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Hide selectors" hint="comma or newline separated">
                  <Textarea
                    value={form.hideElements}
                    onChange={(event) => set("hideElements", event.target.value)}
                    placeholder="#cookie-banner, .ad"
                    className="min-h-14 font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Remove selectors">
                  <Textarea
                    value={form.removeElements}
                    onChange={(event) => set("removeElements", event.target.value)}
                    className="min-h-14 font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="behavior" className="border-border/60">
              <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground/80 hover:no-underline">
                <span className="flex items-center gap-2">
                  <MonitorPlay className="h-3.5 w-3.5 text-primary" /> Behavior
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                <Toggle label="Dark mode (prefers-color-scheme)" checked={form.darkMode} onChange={(v) => set("darkMode", v)} />
                <Toggle label="Disable animations" checked={form.disableAnimations} onChange={(v) => set("disableAnimations", v)} />
                <Toggle label="Block ads" checked={form.blockAds} onChange={(v) => set("blockAds", v)} />
                <Toggle label="Execute JavaScript" checked={form.isJavaScriptEnabled} onChange={(v) => set("isJavaScriptEnabled", v)} />
                <Toggle label="Fail on HTTP error status" checked={form.throwOnHttpError} onChange={(v) => set("throwOnHttpError", v)} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="identity" className="border-border/60">
              <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground/80 hover:no-underline">
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Identity & access
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Field label="User agent">
                  <Input
                    value={form.userAgent}
                    onChange={(event) => set("userAgent", event.target.value)}
                    className="font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Custom headers" hint="one per line — Name: value">
                  <Textarea
                    value={form.headersText}
                    onChange={(event) => set("headersText", event.target.value)}
                    className="min-h-14 font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Cookies" hint="browser string format, one per line">
                  <Textarea
                    value={form.cookiesText}
                    onChange={(event) => set("cookiesText", event.target.value)}
                    className="min-h-14 font-mono text-xs"
                    spellCheck={false}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Basic auth user">
                    <Input
                      value={form.authUser}
                      onChange={(event) => set("authUser", event.target.value)}
                      className="font-mono text-xs"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      value={form.authPass}
                      onChange={(event) => set("authPass", event.target.value)}
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="geometry" className="border-border/60">
              <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground/80 hover:no-underline">
                <span className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-primary" /> Clip & PDF
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <Toggle
                  label="Clip region"
                  checked={form.clipEnabled}
                  onChange={(v) => set("clipEnabled", v)}
                  disabled={form.type === "pdf"}
                />
                {form.clipEnabled && form.type !== "pdf" && (
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ["clipX", "x"],
                        ["clipY", "y"],
                        ["clipW", "w"],
                        ["clipH", "h"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <Input
                          type="number"
                          min={0}
                          value={form[key]}
                          onChange={(event) =>
                            set(key, Math.max(0, Number(event.target.value) || 0))
                          }
                          className="font-mono text-xs"
                        />
                      </Field>
                    ))}
                  </div>
                )}
                {form.type === "pdf" && (
                  <div className="space-y-3">
                    <Field label="Paper format">
                      <Select value={form.pdfFormat} onValueChange={(v) => set("pdfFormat", v)}>
                        <SelectTrigger className="font-mono text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["letter", "legal", "tabloid", "ledger", "a0", "a1", "a2", "a3", "a4", "a5", "a6"].map(
                            (fmt) => (
                              <SelectItem key={fmt} value={fmt}>
                                {fmt.toUpperCase()}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Toggle label="Landscape" checked={form.pdfLandscape} onChange={(v) => set("pdfLandscape", v)} />
                    <Toggle label="Print backgrounds" checked={form.pdfBackground} onChange={(v) => set("pdfBackground", v)} />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button
            onClick={onSubmit}
            disabled={isPending || !form.input.trim()}
            className="w-full gap-2 bg-primary font-mono text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {isPending ? "Capturing" : "Capture"}
          </Button>
        </section>

        {/* ===================== OUTPUT PANEL ===================== */}
        <section className="flex min-h-[70vh] flex-col gap-4 lg:min-h-0">
          <div className="rounded-lg border border-border/70 bg-card/70 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                job log
              </span>
              {isPending && (
                <Badge variant="outline" className="ml-auto gap-1.5 border-primary/40 font-mono text-[10px] text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {(elapsedMs / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
            <p className="px-4 py-3 font-mono text-xs text-foreground/90">
              <span className="text-primary">{log}</span>
              {isPending && <span className="blink text-primary">▊</span>}
            </p>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card/70 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                output
              </span>
              {result && (
                <>
                  <Badge variant="outline" className="border-primary/40 font-mono text-[10px] text-primary">
                    {result.mimeType}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                    {formatBytes(result.bytes)}
                  </Badge>
                  <Badge variant="outline" className="hidden font-mono text-[10px] text-muted-foreground sm:inline-flex">
                    <Clock3 className="mr-1 h-3 w-3" />
                    {(result.durationMs / 1000).toFixed(1)}s
                  </Badge>
                </>
              )}
              {result && (
                <Button
                  size="sm"
                  onClick={onDownload}
                  className="ml-auto gap-2 bg-primary font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              )}
            </div>

            <div className="checkerboard flex flex-1 items-center justify-center overflow-auto p-4">
              {isPending && !result ? (
                <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="font-mono text-xs">
                    spawning browser · navigating · rendering
                  </p>
                </div>
              ) : dataUrl ? (
                result?.mimeType === "application/pdf" ? (
                  <iframe
                    title="PDF preview"
                    src={dataUrl}
                    className="h-full min-h-[60vh] w-full rounded border border-border/60 bg-white"
                  />
                ) : (
                  <img
                    src={dataUrl}
                    alt="Screenshot preview"
                    className="max-h-[70vh] w-auto max-w-full rounded border border-border/60 object-contain shadow-2xl"
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                  <p className="max-w-xs font-mono text-xs leading-relaxed">
                    no capture yet — enter a target on the left and hit CAPTURE.
                    full page, device emulation, PDF export and more are
                    available.
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="px-1 text-center font-mono text-[10px] text-muted-foreground/60">
            engine: sindresorhus/capture-website (Puppeteer) · recent-target
            history stays in this browser only
          </p>
        </section>
      </main>
    </div>
  );
}
