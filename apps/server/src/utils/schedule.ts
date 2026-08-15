import type { ScheduleFrequency } from "../storage/types.js";

const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

/** Computes the next scheduled check time from a given moment (default now). */
export function computeNextRunAt(frequency: ScheduleFrequency, fromIso: string = new Date().toISOString()): string {
  const from = new Date(fromIso).getTime();
  return new Date(from + FREQUENCY_MS[frequency]).toISOString();
}
