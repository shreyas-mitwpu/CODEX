import { ValidationError } from "../errors/app-error";

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  l: "l",
  lt: "l",
  ltr: "l",
  ltrs: "l",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  ml: "ml",
  millilitre: "ml",
  millilitres: "ml",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  nos: "pcs",
  no: "pcs",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  box: "boxes",
  boxes: "boxes",
  bag: "bags",
  bags: "bags",
  roll: "rolls",
  rolls: "rolls"
};

const MASS_TO_GRAMS: Record<string, number> = { kg: 1000, g: 1 };
const VOLUME_TO_ML: Record<string, number> = { l: 1000, ml: 1 };

export function normalizeUnit(unit: string): string {
  const normalized = UNIT_ALIASES[unit.trim().toLowerCase().replace(/\.$/, "")];
  if (!normalized) {
    throw new ValidationError(`Unsupported inventory unit: ${unit}`);
  }
  return normalized;
}

export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) {
    return roundQuantity(quantity);
  }
  if (from in MASS_TO_GRAMS && to in MASS_TO_GRAMS) {
    return roundQuantity(
      (quantity * (MASS_TO_GRAMS[from] as number)) / (MASS_TO_GRAMS[to] as number)
    );
  }
  if (from in VOLUME_TO_ML && to in VOLUME_TO_ML) {
    return roundQuantity(
      (quantity * (VOLUME_TO_ML[from] as number)) / (VOLUME_TO_ML[to] as number)
    );
  }

  throw new ValidationError(`Cannot convert ${from} to ${to}`);
}

export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
