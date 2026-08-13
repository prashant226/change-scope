/** Normalizes a URL for duplicate-monitor detection (§13, §65 unique constraint). */
export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = "";
  // Strip common tracking params so ?utm_source=... doesn't create a "different" page.
  const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  for (const p of trackingParams) url.searchParams.delete(p);
  url.searchParams.sort();
  let normalized = `${url.protocol}//${url.hostname}${url.pathname}`;
  if (url.searchParams.toString()) normalized += `?${url.searchParams.toString()}`;
  return normalized.replace(/\/$/, "").toLowerCase();
}
