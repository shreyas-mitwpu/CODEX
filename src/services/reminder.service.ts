import { randomUUID } from "node:crypto";
import { pool } from "../database/pool";
import type { WhatsAppClient } from "../integrations/whatsapp.client";
import { AuditRepository } from "../repositories/audit.repository";
import { UserRepository } from "../repositories/user.repository";

export class ReminderService {
  constructor(
    private readonly whatsapp: WhatsAppClient,
    private readonly users = new UserRepository(),
    private readonly audit = new AuditRepository()
  ) {}

  async sendMorningReminder(): Promise<{ sent: number; failed: number }> {
    const recipients = await this.users.listActiveByRoles(pool, ["MANAGER", "OPERATOR"]);
    let sent = 0;
    let failed = 0;
    const requestId = randomUUID();

    for (const recipient of recipients) {
      try {
        await this.whatsapp.sendText(
          recipient.phoneNumber,
          "Good morning. Please send the opening stock update, for example: " +
            "\"Morning update: Cement 120 bags, Steel Rod 12mm 850 kg\"."
        );
        sent += 1;
        await this.audit.append(pool, {
          eventType: "MORNING_REMINDER_SENT",
          entityType: "user",
          entityId: recipient.id,
          requestId,
          source: "SCHEDULER"
        });
      } catch {
        failed += 1;
      }
    }
    return { sent, failed };
  }
}
