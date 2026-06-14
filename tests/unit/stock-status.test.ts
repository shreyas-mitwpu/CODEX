import { describe, expect, it } from "vitest";
import { calculateStockStatus } from "../../src/utils/stock-status";

describe("stock status", () => {
  it.each([
    [80, 10, "GREEN"],
    [70, 10, "YELLOW"],
    [30, 10, "RED"],
    [0, 10, "BLACK"]
  ])("maps %s stock at %s daily usage to %s", (stock, usage, expected) => {
    expect(calculateStockStatus(stock, usage).status).toBe(expected);
  });

  it("treats stock without consumption history as green with unknown days", () => {
    expect(calculateStockStatus(100, 0)).toEqual({
      status: "GREEN",
      daysRemaining: null
    });
  });
});
