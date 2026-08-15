/**
 * Chromium launch, split by environment.
 *
 * Locally (and on any normal long-running host/container), we use the
 * `playwright` package's own bundled Chromium — nothing changes there.
 *
 * On Vercel, serverless functions ship a read-only filesystem (except
 * /tmp) and don't include a real browser binary, and `playwright`'s
 * ~300MB bundled download doesn't fit a serverless function's size limit
 * anyway. `@sparticuz/chromium` ships a serverless-sized Chromium build
 * for exactly this case, launched through `playwright-core` (the same
 * Playwright driver, without a bundled browser).
 *
 * The import specifier is a variable rather than a string literal so the
 * bundler can't statically resolve and bundle the multi-hundred-MB
 * `playwright` package into the Vercel function — only the branch that
 * actually runs gets pulled in at runtime.
 */
import type { Browser } from "playwright-core";

export async function launchChromium(): Promise<Browser> {
  if (process.env.VERCEL) {
    const sparticuzModule = "@sparticuz/chromium";
    const playwrightCoreModule = "playwright-core";
    const [{ default: sparticuzChromium }, { chromium }] = await Promise.all([
      import(sparticuzModule),
      import(playwrightCoreModule),
    ]);
    const executablePath = await sparticuzChromium.executablePath();
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath,
      headless: true,
    }) as Promise<Browser>;
  }

  const playwrightModule = "playwright";
  const { chromium } = await import(playwrightModule);
  return chromium.launch({ headless: true }) as Promise<Browser>;
}
