import { supabase } from "./supabaseClient";

/** Fetches the PDF report with the current session's auth header and saves it via a temporary link. */
export async function downloadReportPdf(runId: string, titleForFilename?: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`/api/runs/${runId}/report.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("Could not generate the PDF report.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const safeName = (titleForFilename || "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const link = document.createElement("a");
  link.href = url;
  link.download = `changescope-${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
