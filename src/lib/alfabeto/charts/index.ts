import type { AlfabetoChart, ChartId } from "../types.js";

/**
 * Legacy compatibility boundary. Built-in source-derived chart bytes are not
 * registered in production and cannot be recovered through this old API.
 */
export function getChart(chartId?: ChartId): AlfabetoChart {
  const requested = chartId ?? "tyler-universal";
  throw new Error(
    `review_required: alfabeto chart "${requested}" is quarantined and has no authorized production release`
  );
}

/**
 * List all available chart ids.
 */
export function listChartIds(): ChartId[] {
  return [];
}
