import { createHash } from "node:crypto";
import type { DbClient } from "../database/pool";

interface ReportRow {
  file_name: string;
  mime_type: string;
  content: Buffer;
}

export function hashReportToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class ReportRepository {
  async save(
    client: DbClient,
    input: {
      requestedByUserId?: string;
      token: string;
      fileName: string;
      content: Buffer;
      expiresAt: Date;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO generated_reports (
         requested_by_user_id, token_hash, file_name, content, expires_at
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.requestedByUserId ?? null,
        hashReportToken(input.token),
        input.fileName,
        input.content,
        input.expiresAt
      ]
    );
  }

  async findValidByToken(client: DbClient, token: string): Promise<ReportRow | null> {
    const result = await client.query<ReportRow>(
      `SELECT file_name, mime_type, content
       FROM generated_reports
       WHERE token_hash = $1 AND expires_at > now()`,
      [hashReportToken(token)]
    );
    return result.rows[0] ?? null;
  }

  async deleteExpired(client: DbClient): Promise<number> {
    const result = await client.query("DELETE FROM generated_reports WHERE expires_at <= now()");
    return result.rowCount ?? 0;
  }
}
