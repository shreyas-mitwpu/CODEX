export const INTENT_TYPES = [
  "MORNING_UPDATE",
  "EVENING_UPDATE",
  "STOCK_QUERY",
  "SPECIFIC_QUERY",
  "EXCEL_REQUEST",
  "SUPPLIER_REQUEST",
  "UNKNOWN"
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export const UPDATE_TYPES = ["SNAPSHOT", "CONSUMPTION", "ADJUSTMENT"] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export const STOCK_STATUSES = ["GREEN", "YELLOW", "RED", "BLACK"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const USER_ROLES = ["OWNER", "MANAGER", "OPERATOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface InventoryEntry {
  materialName: string;
  quantity: number;
  unit: string;
}

export interface ParsedInventoryMessage {
  intent: IntentType;
  confidence: number;
  entries: InventoryEntry[];
  materialQuery?: string;
  reportStartDate?: string;
  reportEndDate?: string;
  responseLanguage: "en" | "hinglish";
}

export interface UserRecord {
  id: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  isActive: boolean;
}

export interface MaterialRecord {
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
  canonicalUnit: string;
  reorderLevel: number | null;
  isActive: boolean;
}

export interface StockUpdateRecord {
  id: string;
  materialId: string;
  updateType: UpdateType;
  quantity: number;
  unit: string;
  balanceAfter: number;
  effectiveAt: Date;
  createdAt: Date;
}

export interface CurrentStockItem {
  materialId: string;
  materialName: string;
  unit: string;
  currentStock: number;
  averageDailyUsage: number;
  daysRemaining: number | null;
  status: StockStatus;
  lastUpdatedAt: Date | null;
}

export interface SupplierRecommendation {
  supplierId: string;
  supplierName: string;
  phoneNumber: string | null;
  leadTimeDays: number;
  unitPrice: number | null;
  currency: string;
}

export interface RequestContext {
  actorUserId?: string;
  source: "WHATSAPP" | "API" | "SCHEDULER";
  sourceEventId?: string;
  requestId: string;
}
