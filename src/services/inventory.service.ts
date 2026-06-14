import { pool, withTransaction, type DbClient } from "../database/pool";
import type {
  CurrentStockItem,
  InventoryEntry,
  MaterialRecord,
  RequestContext,
  StockUpdateRecord,
  UpdateType
} from "../domain/types";
import { NotFoundError, ValidationError } from "../errors/app-error";
import { AlertRepository } from "../repositories/alert.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { MaterialRepository } from "../repositories/material.repository";
import { StockRepository } from "../repositories/stock.repository";
import { SupplierRepository } from "../repositories/supplier.repository";
import { UserRepository } from "../repositories/user.repository";
import { normalizeMaterialName } from "../utils/material-name";
import { similarity } from "../utils/string-similarity";
import { calculateStockStatus, formatDaysRemaining } from "../utils/stock-status";
import { convertUnit } from "../utils/units";
import { env } from "../config/env";

interface ResolvedEntry {
  material: MaterialRecord;
  quantity: number;
  unit: string;
}

export interface RecordStockInput {
  updateType: UpdateType;
  entries: InventoryEntry[];
  effectiveAt?: Date;
  notes?: string;
  inboundEventId?: string;
  context: RequestContext;
}

export class InventoryService {
  constructor(
    private readonly materials = new MaterialRepository(),
    private readonly stocks = new StockRepository(),
    private readonly users = new UserRepository(),
    private readonly suppliers = new SupplierRepository(),
    private readonly alerts = new AlertRepository(),
    private readonly audit = new AuditRepository()
  ) {}

  async recordUpdates(
    input: RecordStockInput
  ): Promise<{ updates: StockUpdateRecord[]; inventory: CurrentStockItem[] }> {
    if (input.entries.length === 0) {
      throw new ValidationError("At least one inventory entry is required");
    }
    if (input.updateType === "ADJUSTMENT" && !input.notes?.trim()) {
      throw new ValidationError("Adjustment updates require notes");
    }
    if (
      input.updateType === "CONSUMPTION" &&
      input.entries.some((entry) => entry.quantity <= 0)
    ) {
      throw new ValidationError("Consumption quantities must be greater than zero");
    }
    const effectiveAt = input.effectiveAt ?? new Date();
    if (effectiveAt.getTime() > Date.now() + 5 * 60_000) {
      throw new ValidationError("effectiveAt cannot be more than five minutes in the future");
    }
    if (input.context.actorUserId) {
      const actor = await this.users.findActiveById(pool, input.context.actorUserId);
      if (!actor) throw new NotFoundError("Actor user was not found or is inactive");
    }

    const catalog = await this.materials.listActive(pool);
    const resolved = input.entries.map((entry) => this.resolveEntry(entry, catalog));
    const duplicateIds = resolved
      .map((entry) => entry.material.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      throw new ValidationError("A material may appear only once in a single update");
    }

    const result = await withTransaction(async (client) => {
      const updates: StockUpdateRecord[] = [];
      const transitions: Array<{
        material: MaterialRecord;
        update: StockUpdateRecord;
        balanceBefore: number;
        previousAverageUsage: number;
      }> = [];

      for (const [index, entry] of resolved.entries()) {
        await this.materials.lockById(client, entry.material.id);
        const latest = await this.stocks.getLatestBalanceForUpdate(client, entry.material.id);
        const previousAverageUsage = await this.stocks.getAverageDailyUsage(
          client,
          entry.material.id,
          env.USAGE_WINDOW_DAYS
        );
        const quantity = convertUnit(
          entry.quantity,
          entry.unit,
          entry.material.canonicalUnit
        );
        let balanceAfter: number;
        if (input.updateType === "CONSUMPTION") {
          if (quantity > latest.balance) {
            throw new ValidationError(
              `${entry.material.name} consumption (${quantity} ${entry.material.canonicalUnit}) ` +
                `exceeds available stock (${latest.balance} ${entry.material.canonicalUnit})`
            );
          }
          balanceAfter = latest.balance - quantity;
        } else {
          balanceAfter = quantity;
        }

        const update = await this.stocks.insert(client, {
          materialId: entry.material.id,
          ...(input.context.actorUserId ? { userId: input.context.actorUserId } : {}),
          ...(input.inboundEventId ? { inboundEventId: input.inboundEventId } : {}),
          updateType: input.updateType,
          quantity,
          unit: entry.material.canonicalUnit,
          balanceBefore: latest.balance,
          balanceAfter,
          effectiveAt,
          source: input.context.source,
          sourceLineIndex: index,
          ...(input.notes ? { notes: input.notes } : {})
        });
        updates.push(update);
        transitions.push({
          material: entry.material,
          update,
          balanceBefore: latest.balance,
          previousAverageUsage
        });

        await this.audit.append(client, {
          eventType: "STOCK_UPDATE_CREATED",
          entityType: "stock_update",
          entityId: update.id,
          ...(input.context.actorUserId
            ? { actorUserId: input.context.actorUserId }
            : {}),
          requestId: input.context.requestId,
          source: input.context.source,
          payload: {
            materialId: entry.material.id,
            updateType: input.updateType,
            quantity,
            balanceBefore: latest.balance,
            balanceAfter
          }
        });
      }

      await this.queueCriticalAlerts(client, transitions, input.context);
      return updates;
    });

    const inventory = (
      await Promise.all(
        resolved.map((entry) =>
          this.stocks.listCurrent(pool, env.USAGE_WINDOW_DAYS, entry.material.id)
        )
      )
    ).flat();
    return { updates: result, inventory };
  }

  private resolveEntry(entry: InventoryEntry, catalog: MaterialRecord[]): ResolvedEntry {
    if (!Number.isFinite(entry.quantity) || entry.quantity < 0) {
      throw new ValidationError(`Invalid quantity for ${entry.materialName}`);
    }
    const requested = normalizeMaterialName(entry.materialName);
    const scored = catalog
      .flatMap((material) =>
        [material.normalizedName, ...material.aliases.map(normalizeMaterialName)].map(
          (candidate) => ({ material, score: similarity(requested, candidate) })
        )
      )
      .sort((a, b) => b.score - a.score);
    const match = scored[0];
    if (!match || match.score < 0.82) {
      throw new NotFoundError(`Unknown material: ${entry.materialName}`);
    }
    return { material: match.material, quantity: entry.quantity, unit: entry.unit };
  }

  private async queueCriticalAlerts(
    client: DbClient,
    transitions: Array<{
      material: MaterialRecord;
      update: StockUpdateRecord;
      balanceBefore: number;
      previousAverageUsage: number;
    }>,
    context: RequestContext
  ): Promise<void> {
    const owners = await this.users.listActiveByRoles(client, ["OWNER"]);
    if (owners.length === 0) return;

    for (const transition of transitions) {
      const averageUsage = await this.stocks.getAverageDailyUsage(
        client,
        transition.material.id,
        env.USAGE_WINDOW_DAYS
      );
      const current = calculateStockStatus(
        transition.update.balanceAfter,
        averageUsage
      );
      const previous = calculateStockStatus(
        transition.balanceBefore,
        transition.previousAverageUsage
      );
      if (
        (current.status !== "RED" && current.status !== "BLACK") ||
        previous.status === current.status
      ) {
        continue;
      }

      const supplier = await this.suppliers.findFastestForMaterial(
        client,
        transition.material.id
      );
      const supplierText = supplier
        ? ` Fastest supplier: ${supplier.supplierName} (${supplier.leadTimeDays} day lead time).`
        : " No active supplier is configured.";
      const message =
        `${current.status} ALERT: ${transition.material.name} has ` +
        `${transition.update.balanceAfter} ${transition.material.canonicalUnit} remaining ` +
        `(${formatDaysRemaining(current.daysRemaining)}).${supplierText}`;

      for (const owner of owners) {
        const alertId = await this.alerts.createPending(client, {
          materialId: transition.material.id,
          stockUpdateId: transition.update.id,
          recipientUserId: owner.id,
          status: current.status,
          ...(supplier ? { supplierId: supplier.supplierId } : {}),
          message
        });
        if (alertId) {
          await this.audit.append(client, {
            eventType: "LOW_STOCK_ALERT_QUEUED",
            entityType: "alert",
            entityId: alertId,
            ...(context.actorUserId ? { actorUserId: context.actorUserId } : {}),
            requestId: context.requestId,
            source: context.source,
            payload: {
              materialId: transition.material.id,
              recipientUserId: owner.id,
              status: current.status
            }
          });
        }
      }
    }
  }
}
