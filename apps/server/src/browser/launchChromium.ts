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
import path from "node:path";
import type { Browser } from "playwright-core";

export async function launchChromium(): Promise<Browser> {
  if (process.env.VERCEL) {
    const sparticuzModule = "@sparticuz/chromium";
    const playwrightCoreModule = "playwright-core";
    const [{ default: sparticuzChromium }, { chromium }] = await Promise.all([
      import(sparticuzModule),
      import(playwrightCoreModule),
    ]);

    // Disables Chromium's GPU/graphics stack (headless doesn't need it) —
    // recommended by @sparticuz/chromium for serverless targets. The API
    // shape has changed across versions (property vs. setter method), so
    // handle both rather than assuming one.
    if (typeof (sparticuzChromium as any).setGraphicsMode === "function") {
      (sparticuzChromium as any).setGraphicsMode(false);
    } else {
      sparticuzChromium.setGraphicsMode = false;
    }

    const executablePath = await sparticuzChromium.executablePath();

    // The extracted Chromium binary links against shared libraries
    // (libnss3.so etc.) bundled alongside it in the same /tmp directory —
    // but Vercel's runtime image doesn't have that directory on the
    // dynamic linker's search path by default, so the binary fails to
    // even start ("libnss3.so: cannot open shared object file") unless we
    // point LD_LIBRARY_PATH at it ourselves before launching.
    const execDir = path.dirname(executablePath);
    process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${execDir}:${process.env.LD_LIBRARY_PATH}`
      : execDir;

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
