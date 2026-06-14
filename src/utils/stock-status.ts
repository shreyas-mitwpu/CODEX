import type { StockStatus } from "../domain/types";

export function calculateStockStatus(
  currentStock: number,
  averageDailyUsage: number
): { daysRemaining: number | null; status: StockStatus } {
  if (currentStock <= 0) {
    return { daysRemaining: 0, status: "BLACK" };
  }
  if (averageDailyUsage <= 0) {
    return { daysRemaining: null, status: "GREEN" };
  }

  const daysRemaining = currentStock / averageDailyUsage;
  if (daysRemaining > 7) {
    return { daysRemaining, status: "GREEN" };
  }
  if (daysRemaining > 3) {
    return { daysRemaining, status: "YELLOW" };
  }
  return { daysRemaining, status: "RED" };
}

export function formatDaysRemaining(days: number | null): string {
  if (days === null) return "No recent consumption";
  if (days === 0) return "Depleted";
  return `${days.toFixed(1)} days`;
}
