/**
 * URL validation + SSRF protection (MASTER BUILD PROMPT §42).
 *
 * The user can submit an arbitrary URL, so we must reject anything that could
 * be used to reach internal/private infrastructure or a non-http(s) scheme.
 */
import dns from "node:dns/promises";
import net from "node:net";

export interface UrlSafetyResult {
  ok: boolean;
  reason?: string;
  normalizedUrl?: string;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

/** RFC1918 + link-local + loopback + carrier-grade NAT ranges. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  return false;
}

function isPrivateIp(ip: string): boolean {
  return net.isIP(ip) === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

/** Structural checks that don't require a DNS lookup. Fast fail for obviously bad input. */
export function validateUrlSyntax(rawUrl: string): UrlSafetyResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http and https URLs can be monitored." };
  }

  // IPv6 hostnames from URL.hostname keep their brackets (e.g. "[::1]") — strip
  // them before comparing/parsing as an IP, or loopback/private checks miss them.
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: "That address can't be monitored." };
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, reason: "That address can't be monitored." };
  }

  return { ok: true, normalizedUrl: parsed.toString() };
}

/**
 * Resolves the hostname and rejects it if it points at a private/internal address.
 * Must be re-run against redirect destinations too (§42).
 */
export async function assertHostIsPublic(rawUrl: string): Promise<UrlSafetyResult> {
  const syntax = validateUrlSyntax(rawUrl);
  if (!syntax.ok) return syntax;

  const hostname = new URL(rawUrl).hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) {
    // Already validated in validateUrlSyntax.
    return syntax;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    const blocked = records.find((r) => isPrivateIp(r.address));
    if (blocked) {
      return { ok: false, reason: "That address resolves to a private network and can't be monitored." };
    }
  } catch {
    return { ok: false, reason: "We couldn't resolve that domain name." };
  }

  return syntax;
}
