import type { DbClient } from "../database/pool";
import type {
  CurrentStockItem,
  StockStatus,
  StockUpdateRecord,
  UpdateType
} from "../domain/types";
import { calculateStockStatus } from "../utils/stock-status";

interface BalanceRow {
  id: string;
  balance_after: string;
}

interface StockUpdateRow {
  id: string;
  material_id: string;
  update_type: UpdateType;
  quantity: string;
  unit: string;
  balance_after: string;
  effective_at: Date;
  created_at: Date;
}

interface CurrentStockRow {
  material_id: string;
  material_name: string;
  unit: string;
  current_stock: string;
  average_daily_usage: string;
  last_updated_at: Date | null;
}

export interface StockHistoryItem extends StockUpdateRecord {
  materialName: string;
  userName: string | null;
  source: string;
  balanceBefore: number;
  notes: string | null;
}

interface HistoryRow extends StockUpdateRow {
  material_name: string;
  user_name: string | null;
  source: string;
  balance_before: string;
  notes: string | null;
}

function mapStockUpdate(row: StockUpdateRow): StockUpdateRecord {
  return {
    id: row.id,
    materialId: row.material_id,
    updateType: row.update_type,
    quantity: Number(row.quantity),
    unit: row.unit,
    balanceAfter: Number(row.balance_after),
    effectiveAt: row.effective_at,
    createdAt: row.created_at
  };
}

export class StockRepository {
  async getLatestBalanceForUpdate(
    client: DbClient,
    materialId: string
  ): Promise<{ updateId: string | null; balance: number }> {
    const result = await client.query<BalanceRow>(
      `SELECT id, balance_after
       FROM stock_updates
       WHERE material_id = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [materialId]
    );
    const row = result.rows[0];
    return row
      ? { updateId: row.id, balance: Number(row.balance_after) }
      : { updateId: null, balance: 0 };
  }

  async insert(
    client: DbClient,
    input: {
      materialId: string;
      userId?: string;
      inboundEventId?: string;
      updateType: UpdateType;
      quantity: number;
      unit: string;
      balanceBefore: number;
      balanceAfter: number;
      effectiveAt: Date;
      source: string;
      sourceLineIndex: number;
      notes?: string;
    }
  ): Promise<StockUpdateRecord> {
    const result = await client.query<StockUpdateRow>(
      `INSERT INTO stock_updates (
         material_id, user_id, inbound_event_id, update_type, quantity, unit,
         balance_before, balance_after, effective_at, source, source_line_index, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, material_id, update_type, quantity, unit, balance_after,
         effective_at, created_at`,
      [
        input.materialId,
        input.userId ?? null,
        input.inboundEventId ?? null,
        input.updateType,
        input.quantity,
        input.unit,
        input.balanceBefore,
        input.balanceAfter,
        input.effectiveAt,
        input.source,
        input.sourceLineIndex,
        input.notes ?? null
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error("Stock update insert did not return a record");
    return mapStockUpdate(row);
  }

  async getAverageDailyUsage(
    client: DbClient,
    materialId: string,
    windowDays: number
  ): Promise<number> {
    const result = await client.query<{ average_daily_usage: string }>(
      `SELECT
         COALESCE(
           SUM(quantity) /
           GREATEST(
             1,
             LEAST(
               $2::numeric,
               EXTRACT(day FROM now() - MIN(effective_at)) + 1
             )
           ),
           0
         ) AS average_daily_usage
       FROM stock_updates
       WHERE material_id = $1
         AND update_type = 'CONSUMPTION'
         AND effective_at >= now() - make_interval(days => $2)
         AND effective_at <= now()`,
      [materialId, windowDays]
    );
    return Number(result.rows[0]?.average_daily_usage ?? 0);
  }

  async listCurrent(
    client: DbClient,
    windowDays: number,
    materialId?: string
  ): Promise<CurrentStockItem[]> {
    const values: unknown[] = [windowDays];
    const materialFilter = materialId ? "AND ci.material_id = $2" : "";
    if (materialId) values.push(materialId);

    const result = await client.query<CurrentStockRow>(
      `WITH usage AS (
         SELECT
           material_id,
           SUM(quantity) /
             GREATEST(
               1,
               LEAST(
                 $1::numeric,
                 EXTRACT(day FROM now() - MIN(effective_at)) + 1
               )
             ) AS average_daily_usage
         FROM stock_updates
         WHERE update_type = 'CONSUMPTION'
           AND effective_at >= now() - make_interval(days => $1)
           AND effective_at <= now()
         GROUP BY material_id
       )
       SELECT
         ci.material_id,
         ci.material_name,
         ci.unit,
         ci.current_stock,
         COALESCE(u.average_daily_usage, 0) AS average_daily_usage,
         ci.last_updated_at
       FROM current_inventory ci
       LEFT JOIN usage u ON u.material_id = ci.material_id
       WHERE true ${materialFilter}
       ORDER BY ci.material_name`,
      values
    );

    return result.rows.map((row) => {
      const currentStock = Number(row.current_stock);
      const averageDailyUsage = Number(row.average_daily_usage);
      const { daysRemaining, status } = calculateStockStatus(
        currentStock,
        averageDailyUsage
      );
      return {
        materialId: row.material_id,
        materialName: row.material_name,
        unit: row.unit,
        currentStock,
        averageDailyUsage,
        daysRemaining,
        status,
        lastUpdatedAt: row.last_updated_at
      };
    });
  }

  async listHistory(
    client: DbClient,
    filters: {
      materialId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<StockHistoryItem[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown): void => {
      values.push(value);
      conditions.push(sql.replace("?", `$${values.length}`));
    };
    if (filters.materialId) add("su.material_id = ?", filters.materialId);
    if (filters.startDate) add("su.effective_at >= ?", filters.startDate);
    if (filters.endDate) add("su.effective_at <= ?", filters.endDate);

    values.push(filters.limit ?? 100);
    const limitIndex = values.length;
    values.push(filters.offset ?? 0);
    const offsetIndex = values.length;
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query<HistoryRow>(
      `SELECT
         su.id, su.material_id, m.name AS material_name, su.update_type,
         su.quantity, su.unit, su.balance_before, su.balance_after,
         su.effective_at, su.created_at, u.name AS user_name, su.source, su.notes
       FROM stock_updates su
       JOIN materials m ON m.id = su.material_id
       LEFT JOIN users u ON u.id = su.user_id
       ${where}
       ORDER BY su.effective_at DESC, su.created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );

    return result.rows.map((row) => ({
      ...mapStockUpdate(row),
      materialName: row.material_name,
      userName: row.user_name,
      source: row.source,
      balanceBefore: Number(row.balance_before),
      notes: row.notes
    }));
  }

  async getDashboardSummary(
    client: DbClient,
    windowDays: number
  ): Promise<{
    totals: Record<StockStatus, number>;
    criticalItems: CurrentStockItem[];
    recentlyUpdated: CurrentStockItem[];
  }> {
    const items = await this.listCurrent(client, windowDays);
    const totals: Record<StockStatus, number> = {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
      BLACK: 0
    };
    for (const item of items) totals[item.status] += 1;

    return {
      totals,
      criticalItems: items.filter((item) => item.status === "RED" || item.status === "BLACK"),
      recentlyUpdated: [...items]
        .sort(
          (a, b) =>
            (b.lastUpdatedAt?.getTime() ?? 0) - (a.lastUpdatedAt?.getTime() ?? 0)
        )
        .slice(0, 10)
    };
  }
}
