import type { DbClient } from "../database/pool";

export class AuditRepository {
  async append(
    client: DbClient,
    input: {
      eventType: string;
      entityType: string;
      entityId?: string;
      actorUserId?: string;
      requestId: string;
      source: string;
      payload?: Record<string, unknown>;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_events (
         event_type, entity_type, entity_id, actor_user_id, request_id, source, payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.eventType,
        input.entityType,
        input.entityId ?? null,
        input.actorUserId ?? null,
        input.requestId,
        input.source,
        JSON.stringify(input.payload ?? {})
      ]
    );
  }
}
