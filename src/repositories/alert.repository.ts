import type { DbClient } from "../database/pool";
import type { StockStatus } from "../domain/types";

export interface AlertRecord {
  id: string;
  materialId: string;
  materialName: string;
  recipientUserId: string;
  recipientName: string;
  recipientPhone: string;
  status: StockStatus;
  deliveryStatus: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  message: string;
  attempts: number;
  createdAt: Date;
  supplierName: string | null;
}

interface AlertRow {
  id: string;
  material_id: string;
  material_name: string;
  recipient_user_id: string;
  recipient_name: string;
  recipient_phone: string;
  status: StockStatus;
  delivery_status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  message: string;
  attempts: number;
  created_at: Date;
  supplier_name: string | null;
}

function mapAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    materialId: row.material_id,
    materialName: row.material_name,
    recipientUserId: row.recipient_user_id,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    status: row.status,
    deliveryStatus: row.delivery_status,
    message: row.message,
    attempts: row.attempts,
    createdAt: row.created_at,
    supplierName: row.supplier_name
  };
}

export class AlertRepository {
  async createPending(
    client: DbClient,
    input: {
      materialId: string;
      stockUpdateId: string;
      recipientUserId: string;
      status: "RED" | "BLACK";
      supplierId?: string;
      message: string;
    }
  ): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO alerts_sent (
         material_id, stock_update_id, recipient_user_id, status, supplier_id, message
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stock_update_id, recipient_user_id, status) DO NOTHING
       RETURNING id`,
      [
        input.materialId,
        input.stockUpdateId,
        input.recipientUserId,
        input.status,
        input.supplierId ?? null,
        input.message
      ]
    );
    return result.rows[0]?.id ?? null;
  }

  async listPending(client: DbClient, limit = 100): Promise<AlertRecord[]> {
    const result = await client.query<AlertRow>(
      `SELECT
         a.id, a.material_id, m.name AS material_name,
         a.recipient_user_id, u.name AS recipient_name,
         u.phone_number AS recipient_phone, a.status, a.delivery_status,
         a.message, a.attempts, a.created_at, s.name AS supplier_name
       FROM alerts_sent a
       JOIN materials m ON m.id = a.material_id
       JOIN users u ON u.id = a.recipient_user_id
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       WHERE a.delivery_status IN ('PENDING', 'FAILED')
         AND a.attempts < 5
       ORDER BY a.created_at
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapAlert);
  }

  async claimForDelivery(client: DbClient, limit = 20): Promise<AlertRecord[]> {
    const result = await client.query<AlertRow>(
      `WITH candidates AS (
         SELECT id
         FROM alerts_sent
         WHERE (
           delivery_status IN ('PENDING', 'FAILED')
           OR (delivery_status = 'PROCESSING' AND claimed_at < now() - interval '10 minutes')
         )
           AND attempts < 5
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       ),
       claimed AS (
         UPDATE alerts_sent a
         SET delivery_status = 'PROCESSING', claimed_at = now()
         FROM candidates c
         WHERE a.id = c.id
         RETURNING a.*
       )
       SELECT
         a.id, a.material_id, m.name AS material_name,
         a.recipient_user_id, u.name AS recipient_name,
         u.phone_number AS recipient_phone, a.status, a.delivery_status,
         a.message, a.attempts, a.created_at, s.name AS supplier_name
       FROM claimed a
       JOIN materials m ON m.id = a.material_id
       JOIN users u ON u.id = a.recipient_user_id
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       ORDER BY a.created_at`,
      [limit]
    );
    return result.rows.map(mapAlert);
  }

  async listAll(client: DbClient, limit = 10_000): Promise<AlertRecord[]> {
    const result = await client.query<AlertRow>(
      `SELECT
         a.id, a.material_id, m.name AS material_name,
         a.recipient_user_id, u.name AS recipient_name,
         u.phone_number AS recipient_phone, a.status, a.delivery_status,
         a.message, a.attempts, a.created_at, s.name AS supplier_name
       FROM alerts_sent a
       JOIN materials m ON m.id = a.material_id
       JOIN users u ON u.id = a.recipient_user_id
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapAlert);
  }

  async markSent(client: DbClient, id: string, providerMessageSid: string): Promise<void> {
    await client.query(
      `UPDATE alerts_sent
       SET delivery_status = 'SENT', provider_message_sid = $2,
           attempts = attempts + 1, sent_at = now(), last_error = NULL
       WHERE id = $1`,
      [id, providerMessageSid]
    );
  }

  async markFailed(client: DbClient, id: string, error: string): Promise<void> {
    await client.query(
      `UPDATE alerts_sent
       SET delivery_status = 'FAILED', attempts = attempts + 1,
           last_error = left($2, 1000)
       WHERE id = $1`,
      [id, error]
    );
  }
}
