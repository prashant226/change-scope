import type { ScheduleFrequency } from "../storage/types.js";

const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
  hourly: 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** Computes the next scheduled check time from a given moment (default now). */
export function computeNextRunAt(frequency: ScheduleFrequency, fromIso: string = new Date().toISOString()): string {
  const from = new Date(fromIso).getTime();
  return new Date(from + FREQUENCY_MS[frequency]).toISOString();
}
