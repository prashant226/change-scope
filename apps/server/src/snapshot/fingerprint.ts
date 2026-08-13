import { createHash } from "node:crypto";

/** Deterministic short hash used for stable element/image identity signals (§47). */
export function fingerprint(...parts: Array<string | number | null | undefined>): string {
  const joined = parts.map((p) => (p === undefined || p === null ? "" : String(p))).join("|");
  return createHash("sha1").update(joined).digest("hex").slice(0, 16);
}
