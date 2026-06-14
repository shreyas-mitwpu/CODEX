import type { DbClient } from "../database/pool";

interface InboundEventRow {
  id: string;
  processing_status: string;
}

export class EventRepository {
  async createOrGet(
    client: DbClient,
    input: {
      provider: string;
      providerEventId: string;
      senderPhone: string;
      messageBody: string;
    }
  ): Promise<{ id: string; isNew: boolean; status: string }> {
    const inserted = await client.query<InboundEventRow>(
      `INSERT INTO inbound_events (provider, provider_event_id, sender_phone, message_body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_event_id) DO NOTHING
       RETURNING id, processing_status`,
      [input.provider, input.providerEventId, input.senderPhone, input.messageBody]
    );
    if (inserted.rows[0]) {
      return {
        id: inserted.rows[0].id,
        isNew: true,
        status: inserted.rows[0].processing_status
      };
    }
    const existing = await client.query<InboundEventRow>(
      `SELECT id, processing_status
       FROM inbound_events
       WHERE provider = $1 AND provider_event_id = $2`,
      [input.provider, input.providerEventId]
    );
    const row = existing.rows[0];
    if (!row) throw new Error("Inbound event conflict could not be resolved");
    return { id: row.id, isNew: false, status: row.processing_status };
  }

  async claimForProcessing(client: DbClient, id: string): Promise<boolean> {
    const result = await client.query(
      `UPDATE inbound_events
       SET processing_status = 'PROCESSING', error_message = NULL
       WHERE id = $1 AND processing_status IN ('RECEIVED', 'FAILED')`,
      [id]
    );
    return (result.rowCount ?? 0) === 1;
  }

  async markProcessed(client: DbClient, id: string, intent: string): Promise<void> {
    await client.query(
      `UPDATE inbound_events
       SET processing_status = 'PROCESSED', detected_intent = $2, processed_at = now(),
           error_message = NULL
       WHERE id = $1`,
      [id, intent]
    );
  }

  async markFailed(client: DbClient, id: string, errorMessage: string): Promise<void> {
    await client.query(
      `UPDATE inbound_events
       SET processing_status = 'FAILED', error_message = left($2, 1000), processed_at = now()
       WHERE id = $1`,
      [id, errorMessage]
    );
  }
}
