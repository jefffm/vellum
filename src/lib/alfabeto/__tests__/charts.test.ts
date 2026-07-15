import { describe, expect, it } from "vitest";
import { getChart, listChartIds } from "../charts/index.js";

describe("quarantined chart compatibility boundary", () => {
  it("publishes no built-in production chart ids", () => {
    expect(listChartIds()).toEqual([]);
  });

  it("fails closed for omitted and explicit legacy locators", () => {
    expect(() => getChart()).toThrow(/review_required.*quarantined/i);
    expect(() => getChart("tyler-universal")).toThrow(/review_required.*quarantined/i);
    expect(() => getChart("foscarini")).toThrow(/review_required.*quarantined/i);
  });
});
