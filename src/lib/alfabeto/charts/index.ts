import type { AlfabetoChart, ChartId } from "../types.js";
import { FOSCARINI } from "./foscarini.js";
import { TYLER_UNIVERSAL } from "./tyler-universal.js";

const CHARTS: ReadonlyMap<ChartId, AlfabetoChart> = new Map<ChartId, AlfabetoChart>([
  ["tyler-universal", TYLER_UNIVERSAL],
  ["foscarini", FOSCARINI],
]);

/**
 * Retrieve an alfabeto chart by id.
 * Defaults to Tyler Universal if no id provided.
 */
export function getChart(chartId: ChartId = "tyler-universal"): AlfabetoChart {
  const chart = CHARTS.get(chartId);

  if (!chart) {
    throw new Error(`Unknown alfabeto chart: ${chartId}`);
  }

  return chart;
}

/**
 * List all available chart ids.
 */
export function listChartIds(): ChartId[] {
  return [...CHARTS.keys()];
}

export { TYLER_UNIVERSAL } from "./tyler-universal.js";
export { FOSCARINI } from "./foscarini.js";
