import { describe, expect, it } from "vitest";
import type { MaterialRecord } from "../../src/domain/types";
import { heuristicParse } from "../../src/ai/inventory-parser";

const materials: MaterialRecord[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Cement",
    normalizedName: "cement",
    aliases: ["cem", "cement bags"],
    canonicalUnit: "bags",
    reorderLevel: 50,
    isActive: true
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Steel Rod 12mm",
    normalizedName: "steel rod 12mm",
    aliases: ["saria 12mm"],
    canonicalUnit: "kg",
    reorderLevel: 500,
    isActive: true
  }
];

describe("deterministic parser fallback", () => {
  it("understands a Hinglish morning snapshot", () => {
    const result = heuristicParse(
      "Subah update: cement 120 bags, saria 12mm 850 kg",
      materials
    );
    expect(result.intent).toBe("MORNING_UPDATE");
    expect(result.responseLanguage).toBe("hinglish");
    expect(result.entries).toEqual([
      { materialName: "Cement", quantity: 120, unit: "bags" },
      { materialName: "Steel Rod 12mm", quantity: 850, unit: "kg" }
    ]);
  });

  it("recognizes a specific stock query", () => {
    const result = heuristicParse("Cement kitna bacha hai?", materials);
    expect(result.intent).toBe("SPECIFIC_QUERY");
    expect(result.materialQuery).toBe("Cement");
  });
});
