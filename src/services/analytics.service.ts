import { env } from "../config/env";
import { pool } from "../database/pool";
import type { CurrentStockItem } from "../domain/types";
import { MaterialRepository } from "../repositories/material.repository";
import {
  StockRepository,
  type StockHistoryItem
} from "../repositories/stock.repository";
import { NotFoundError } from "../errors/app-error";

export class AnalyticsService {
  constructor(
    private readonly stocks = new StockRepository(),
    private readonly materials = new MaterialRepository()
  ) {}

  async getCurrent(materialQuery?: string): Promise<CurrentStockItem[]> {
    if (!materialQuery) {
      return this.stocks.listCurrent(pool, env.USAGE_WINDOW_DAYS);
    }
    const material = await this.materials.findByNameOrAlias(pool, materialQuery);
    if (!material) throw new NotFoundError(`Unknown material: ${materialQuery}`);
    return this.stocks.listCurrent(pool, env.USAGE_WINDOW_DAYS, material.id);
  }

  async getHistory(filters: {
    materialQuery?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<StockHistoryItem[]> {
    const material = filters.materialQuery
      ? await this.materials.findByNameOrAlias(pool, filters.materialQuery)
      : null;
    if (filters.materialQuery && !material) {
      throw new NotFoundError(`Unknown material: ${filters.materialQuery}`);
    }
    return this.stocks.listHistory(pool, {
      ...(material ? { materialId: material.id } : {}),
      ...(filters.startDate ? { startDate: filters.startDate } : {}),
      ...(filters.endDate ? { endDate: filters.endDate } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {})
    });
  }

  async getDashboard(): Promise<Awaited<ReturnType<StockRepository["getDashboardSummary"]>>> {
    return this.stocks.getDashboardSummary(pool, env.USAGE_WINDOW_DAYS);
  }
}
