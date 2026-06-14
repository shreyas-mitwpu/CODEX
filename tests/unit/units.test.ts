import { describe, expect, it } from "vitest";
import { convertUnit, normalizeUnit } from "../../src/utils/units";

describe("unit normalization", () => {
  it("normalizes common inventory abbreviations", () => {
    expect(normalizeUnit("KGS")).toBe("kg");
    expect(normalizeUnit("ltr")).toBe("l");
    expect(normalizeUnit("nos")).toBe("pcs");
  });

  it("converts compatible mass and volume units", () => {
    expect(convertUnit(2500, "g", "kg")).toBe(2.5);
    expect(convertUnit(1.5, "l", "ml")).toBe(1500);
  });

  it("rejects conversion between incompatible dimensions", () => {
    expect(() => convertUnit(2, "bags", "kg")).toThrow("Cannot convert");
  });
});
