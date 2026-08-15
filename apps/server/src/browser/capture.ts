/**
 * Playwright capture layer (MASTER BUILD PROMPT §39-41, §61).
 *
 * Responsibilities: open the URL, render it, scroll to trigger lazy content,
 * pull the generic DOM extraction, take a screenshot, and grab raw HTML.
 * This is an *observation* agent — it never submits forms, logs in, or clicks
 * anything beyond dismissing an obvious cookie/consent overlay.
 */
import type { Browser } from "playwright-core";
import { launchChromium } from "./launchChromium.js";
import { assertHostIsPublic, validateUrlSyntax } from "./urlSafety.js";
import { extractPage } from "./extractPage.js";
import type { RawExtractionResult } from "./extractPage.js";
import type { RunErrorInfo } from "../types/run.js";

export interface CaptureResult {
  ok: true;
  finalUrl: string;
  title: string;
  html: string;
  screenshotBuffer: Buffer;
  extraction: RawExtractionResult;
}

export interface CaptureFailure {
  ok: false;
  error: RunErrorInfo;
}

/**
 * The dev/test toolchain (tsx/esbuild) injects `__name(fn, "fn")` calls into
 * transpiled functions for nicer stack traces. That helper lives at module
 * scope, so it's absent when a function is serialized via `.toString()` and
 * shipped into the browser via page.evaluate — stripping those calls before
 * evaluation keeps the injected page-side script self-contained.
 */
function serializeForBrowser<T>(fn: () => T): string {
  const source = fn.toString().replace(/\b__name\([^;]*\);?/g, "");
  return `(${source})()`;
}

const CONSENT_BUTTON_TEXT = [
  "accept all", "accept cookies", "i accept", "agree", "allow all", "got it",
];

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await launchChromium();
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

async function dismissConsentOverlay(page: import("playwright").Page): Promise<void> {
  for (const label of CONSENT_BUTTON_TEXT) {
    try {
      const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => undefined);
        return;
      }
    } catch {
      // Best-effort only — never let overlay handling break the capture.
    }
  }
}

async function boundedScroll(
  page: import("playwright").Page,
  maxDurationMs: number,
  maxSteps: number,
): Promise<void> {
  const start = Date.now();
  let lastHeight = 0;
  let stableCount = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (Date.now() - start > maxDurationMs) break;

    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === lastHeight) {
      stableCount++;
      if (stableCount >= 2) break; // page height stabilized, stop scrolling
    } else {
      stableCount = 0;
    }
    lastHeight = height;

    await page.evaluate((h) => window.scrollTo(0, h), height);
    await page.waitForTimeout(300);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

export interface CaptureOptions {
  timeoutMs: number;
  maxScrollDurationMs: number;
  maxScrollSteps: number;
}

export async function capturePage(
  url: string,
  options: CaptureOptions,
): Promise<CaptureResult | CaptureFailure> {
  const syntax = validateUrlSyntax(url);
  if (!syntax.ok) {
    return { ok: false, error: { code: "invalid_url", message: syntax.reason || "Invalid URL." } };
  }

  const dnsCheck = await assertHostIsPublic(url);
  if (!dnsCheck.ok) {
    return { ok: false, error: { code: "ssrf_blocked", message: dnsCheck.reason || "That address can't be monitored." } };
  }

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    return { ok: false, error: { code: "unknown", message: "Could not start the browser engine." } };
  }

  const context = await browser.newContext({
    userAgent: "ChangeScope-Agent/1.0 (+observation only; no forms submitted)",
    viewport: { width: 1366, height: 900 },
  });

  try {
    const page = await context.newPage();

    // Re-validate the *response's* final URL host to guard against redirect-based SSRF (§42).
    page.on("response", () => undefined);

    let response;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message.includes("Timeout")) {
        return { ok: false, error: { code: "timeout", message: "The page took too long to respond." } };
      }
      if (message.includes("ERR_NAME_NOT_RESOLVED")) {
        return { ok: false, error: { code: "dns_error", message: "We couldn't find that domain." } };
      }
      return { ok: false, error: { code: "network_error", message: "We couldn't reach that page." } };
    }

    const finalUrl = page.url();
    const finalHostCheck = await assertHostIsPublic(finalUrl);
    if (!finalHostCheck.ok) {
      return { ok: false, error: { code: "ssrf_blocked", message: "The page redirected to a blocked address." } };
    }

    if (response) {
      const status = response.status();
      if (status === 404) {
        return { ok: false, error: { code: "http_error", message: "That page returned a 404 Not Found." } };
      }
      if (status === 403) {
        return { ok: false, error: { code: "http_error", message: "Access to that page was refused (403)." } };
      }
      if (status >= 500) {
        return { ok: false, error: { code: "http_error", message: `The site returned a server error (${status}).` } };
      }
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 10000) });
    } catch {
      // Non-fatal: some pages never go fully idle (polling, websockets). Proceed with what rendered.
    }

    await dismissConsentOverlay(page);
    await boundedScroll(page, options.maxScrollDurationMs, options.maxScrollSteps);

    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() ?? "");
    if (!bodyText || bodyText.length < 20) {
      return { ok: false, error: { code: "render_failure", message: "The page rendered without usable content." } };
    }

    const extraction = await page.evaluate<RawExtractionResult>(serializeForBrowser(extractPage));
    const html = await page.content();
    const screenshotBuffer = await page.screenshot({ fullPage: true });

    return {
      ok: true,
      finalUrl,
      title: extraction.title || (await page.title()),
      html,
      screenshotBuffer,
      extraction,
    };
  } catch (err: any) {
    console.error("[capture] Unexpected capture failure:", err?.stack || err);
    return { ok: false, error: { code: "unknown", message: "Something went wrong while capturing the page." } };
  } finally {
    await context.close().catch(() => undefined);
  }
}
