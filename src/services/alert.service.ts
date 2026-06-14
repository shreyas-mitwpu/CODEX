import { logger } from "../config/logger";
import { pool, withTransaction } from "../database/pool";
import { AlertRepository, type AlertRecord } from "../repositories/alert.repository";
import type { WhatsAppClient } from "../integrations/whatsapp.client";

export class AlertService {
  constructor(
    private readonly whatsapp: WhatsAppClient,
    private readonly alerts = new AlertRepository()
  ) {}

  async listPending(limit = 100): Promise<AlertRecord[]> {
    return this.alerts.listPending(pool, limit);
  }

  async dispatchPending(limit = 20): Promise<{ sent: number; failed: number }> {
    const claimed = await withTransaction((client) =>
      this.alerts.claimForDelivery(client, limit)
    );
    let sent = 0;
    let failed = 0;

    for (const alert of claimed) {
      try {
        const sid = await this.whatsapp.sendText(alert.recipientPhone, alert.message);
        await this.alerts.markSent(pool, alert.id, sid);
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown delivery error";
        logger.error({ err: error, alertId: alert.id }, "Low-stock alert delivery failed");
        await this.alerts.markFailed(pool, alert.id, message);
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
