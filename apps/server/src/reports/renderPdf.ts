/**
 * Renders a self-contained HTML report to a PDF buffer via a headless
 * Chromium page. Uses its own short-lived browser instance rather than
 * sharing browser/capture.ts's shared instance — PDF export is an
 * infrequent, on-demand user action, not worth coupling to capture
 * concurrency.
 */
import { launchChromium } from "../browser/launchChromium.js";

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
