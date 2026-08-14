import type { ReportType } from "../types/run.js";

/**
 * The ONLY rule for report type: does a previous successful snapshot exist?
 * Never infer this from array order, timestamps, row order, or anything else.
 */
export function determineReportType(hasPreviousSnapshot: boolean): ReportType {
  return hasPreviousSnapshot ? "comparison" : "baseline";
}
