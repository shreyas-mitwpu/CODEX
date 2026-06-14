import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { pool } from "../database/pool";
import { AppError, UnauthorizedError, ValidationError } from "../errors/app-error";
import type { WhatsAppClient } from "../integrations/whatsapp.client";
import { ClaudeInventoryParser, type InventoryMessageParser } from "../ai/inventory-parser";
import { AlertRepository } from "../repositories/alert.repository";
import { AuditRepository } from "../repositories/audit.repository";
import { EventRepository } from "../repositories/event.repository";
import { MaterialRepository } from "../repositories/material.repository";
import { UserRepository } from "../repositories/user.repository";
import { normalizeWhatsAppPhone } from "../utils/phone";
import { formatDaysRemaining } from "../utils/stock-status";
import { AlertService } from "./alert.service";
import { AnalyticsService } from "./analytics.service";
import { InventoryService } from "./inventory.service";
import { ReportService } from "./report.service";
import { SupplierService } from "./supplier.service";

export interface InboundWhatsAppMessage {
  messageSid: string;
  from: string;
  body: string;
}

export class WhatsAppService {
  private readonly alertService: AlertService;

  constructor(
    private readonly whatsapp: WhatsAppClient,
    private readonly parser: InventoryMessageParser = new ClaudeInventoryParser(),
    private readonly inventory = new InventoryService(),
    private readonly analytics = new AnalyticsService(),
    private readonly suppliers = new SupplierService(),
    private readonly reports = new ReportService(),
    private readonly events = new EventRepository(),
    private readonly users = new UserRepository(),
    private readonly materials = new MaterialRepository(),
    private readonly audit = new AuditRepository(),
    alertRepository = new AlertRepository()
  ) {
    this.alertService = new AlertService(whatsapp, alertRepository);
  }

  async handleInbound(input: InboundWhatsAppMessage): Promise<void> {
    const senderPhone = normalizeWhatsAppPhone(input.from);
    const event = await this.events.createOrGet(pool, {
      provider: "TWILIO",
      providerEventId: input.messageSid,
      senderPhone,
      messageBody: input.body
    });
    const claimed = await this.events.claimForProcessing(pool, event.id);
    if (!claimed) {
      logger.info(
        { eventId: event.id, messageSid: input.messageSid, status: event.status },
        "Duplicate WhatsApp event ignored"
      );
      return;
    }

    const requestId = randomUUID();
    try {
      const user = await this.users.findActiveByPhone(pool, senderPhone);
      if (!user) {
        throw new UnauthorizedError(
          "This phone number is not registered in FactoryMind. Contact the factory owner."
        );
      }
      const catalog = await this.materials.listActive(pool);
      const parsed = await this.parser.parse(input.body, catalog);

      await this.audit.append(pool, {
        eventType: "WHATSAPP_MESSAGE_CLASSIFIED",
        entityType: "inbound_event",
        entityId: event.id,
        actorUserId: user.id,
        requestId,
        source: "WHATSAPP",
        payload: { intent: parsed.intent, confidence: parsed.confidence }
      });

      if (parsed.confidence < env.AI_CONFIDENCE_THRESHOLD) {
        await this.sendText(
          user.phoneNumber,
          "I could not confidently understand that. Try: " +
            "\"Morning update: Cement 100 bags\" or \"How much cement is left?\"",
          user.id,
          requestId,
          event.id
        );
        await this.events.markProcessed(pool, event.id, "UNKNOWN");
        return;
      }

      switch (parsed.intent) {
        case "MORNING_UPDATE": {
          if (parsed.entries.length === 0) {
            throw new ValidationError("No stock quantities were found in the morning update");
          }
          const result = await this.inventory.recordUpdates({
            updateType: "SNAPSHOT",
            entries: parsed.entries,
            inboundEventId: event.id,
            context: {
              actorUserId: user.id,
              source: "WHATSAPP",
              requestId
            }
          });
          await this.sendText(
            user.phoneNumber,
            `Opening stock saved.\n${formatInventory(result.inventory)}`,
            user.id,
            requestId,
            event.id
          );
          await this.alertService.dispatchPending();
          break;
        }
        case "EVENING_UPDATE": {
          if (parsed.entries.length === 0) {
            throw new ValidationError("No consumption quantities were found in the update");
          }
          const result = await this.inventory.recordUpdates({
            updateType: "CONSUMPTION",
            entries: parsed.entries,
            inboundEventId: event.id,
            context: {
              actorUserId: user.id,
              source: "WHATSAPP",
              requestId
            }
          });
          await this.sendText(
            user.phoneNumber,
            `Consumption saved.\n${formatInventory(result.inventory)}`,
            user.id,
            requestId,
            event.id
          );
          await this.alertService.dispatchPending();
          break;
        }
        case "STOCK_QUERY": {
          const current = await this.analytics.getCurrent();
          await this.sendText(
            user.phoneNumber,
            current.length ? formatInventory(current) : "No inventory has been configured.",
            user.id,
            requestId,
            event.id
          );
          break;
        }
        case "SPECIFIC_QUERY": {
          if (!parsed.materialQuery) {
            throw new ValidationError("Please specify a material");
          }
          const current = await this.analytics.getCurrent(parsed.materialQuery);
          await this.sendText(
            user.phoneNumber,
            formatInventory(current),
            user.id,
            requestId,
            event.id
          );
          break;
        }
        case "SUPPLIER_REQUEST": {
          if (!parsed.materialQuery) {
            throw new ValidationError("Please specify the material for supplier lookup");
          }
          const result = await this.suppliers.recommend(parsed.materialQuery);
          const supplier = result.recommendation;
          await this.sendText(
            user.phoneNumber,
            `${result.materialName}: ${supplier.supplierName}, ` +
              `${supplier.leadTimeDays} day lead time` +
              `${supplier.phoneNumber ? `, ${supplier.phoneNumber}` : ""}` +
              `${supplier.unitPrice !== null
                ? `, ${supplier.currency} ${supplier.unitPrice} per unit`
                : ""}.`,
            user.id,
            requestId,
            event.id
          );
          break;
        }
        case "EXCEL_REQUEST": {
          const report = await this.reports.generate({
            requestedByUserId: user.id,
            ...(parsed.reportStartDate
              ? { startDate: new Date(`${parsed.reportStartDate}T00:00:00.000Z`) }
              : {}),
            ...(parsed.reportEndDate
              ? { endDate: new Date(`${parsed.reportEndDate}T23:59:59.999Z`) }
              : {})
          });
          const sid = await this.whatsapp.sendMedia(
            user.phoneNumber,
            "Your FactoryMind inventory report is ready.",
            report.downloadUrl
          );
          await this.audit.append(pool, {
            eventType: "WHATSAPP_REPORT_SENT",
            entityType: "inbound_event",
            entityId: event.id,
            actorUserId: user.id,
            requestId,
            source: "WHATSAPP",
            payload: { providerMessageSid: sid, fileName: report.fileName }
          });
          break;
        }
        case "UNKNOWN":
          await this.sendText(
            user.phoneNumber,
            "I can save morning stock, record evening consumption, check stock, " +
              "recommend suppliers, and create Excel reports.",
            user.id,
            requestId,
            event.id
          );
          break;
      }

      await this.events.markProcessed(pool, event.id, parsed.intent);
    } catch (error) {
      let processingError: unknown = error;
      if (error instanceof AppError && error.statusCode < 500) {
        try {
          await this.whatsapp.sendText(senderPhone, error.message);
          await this.events.markProcessed(pool, event.id, error.code);
          return;
        } catch (deliveryError) {
          processingError = deliveryError;
        }
      }
      const message =
        processingError instanceof Error
          ? processingError.message
          : "Unknown processing error";
      await this.events.markFailed(pool, event.id, message);
      throw processingError;
    }
  }

  private async sendText(
    phone: string,
    message: string,
    userId: string,
    requestId: string,
    inboundEventId: string
  ): Promise<void> {
    const chunks = splitMessage(message, 1400);
    for (const [index, chunk] of chunks.entries()) {
      const sid = await this.whatsapp.sendText(phone, chunk);
      await this.audit.append(pool, {
        eventType: "WHATSAPP_RESPONSE_SENT",
        entityType: "inbound_event",
        entityId: inboundEventId,
        actorUserId: userId,
        requestId,
        source: "WHATSAPP",
        payload: { providerMessageSid: sid, chunkIndex: index, chunkCount: chunks.length }
      });
    }
  }
}

function splitMessage(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) return [message];
  const chunks: string[] = [];
  let current = "";
  for (const line of message.split("\n")) {
    if (line.length > maxLength) {
      if (current) chunks.push(current);
      for (let index = 0; index < line.length; index += maxLength) {
        chunks.push(line.slice(index, index + maxLength));
      }
      current = "";
    } else if (`${current}${current ? "\n" : ""}${line}`.length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += `${current ? "\n" : ""}${line}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function formatInventory(items: Awaited<ReturnType<AnalyticsService["getCurrent"]>>): string {
  return items
    .map(
      (item) =>
        `${item.status} | ${item.materialName}: ${item.currentStock} ${item.unit} | ` +
        `${formatDaysRemaining(item.daysRemaining)}`
    )
    .join("\n");
}
