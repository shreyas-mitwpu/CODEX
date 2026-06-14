import type { DbClient } from "../database/pool";
import type { MaterialRecord } from "../domain/types";
import { normalizeMaterialName } from "../utils/material-name";

interface MaterialRow {
  id: string;
  name: string;
  normalized_name: string;
  aliases: string[];
  canonical_unit: string;
  reorder_level: string | null;
  is_active: boolean;
}

function mapMaterial(row: MaterialRow): MaterialRecord {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    aliases: row.aliases,
    canonicalUnit: row.canonical_unit,
    reorderLevel: row.reorder_level === null ? null : Number(row.reorder_level),
    isActive: row.is_active
  };
}

export class MaterialRepository {
  async listActive(client: DbClient): Promise<MaterialRecord[]> {
    const result = await client.query<MaterialRow>(
      `SELECT id, name, normalized_name, aliases, canonical_unit, reorder_level, is_active
       FROM materials
       WHERE is_active = true
       ORDER BY name`
    );
    return result.rows.map(mapMaterial);
  }

  async findByNameOrAlias(
    client: DbClient,
    requestedName: string
  ): Promise<MaterialRecord | null> {
    const normalized = normalizeMaterialName(requestedName);
    const result = await client.query<MaterialRow>(
      `SELECT id, name, normalized_name, aliases, canonical_unit, reorder_level, is_active
       FROM materials
       WHERE is_active = true
         AND (
           normalized_name = $1
           OR EXISTS (
             SELECT 1 FROM unnest(aliases) alias
             WHERE lower(regexp_replace(trim(alias), '[^a-zA-Z0-9]+', ' ', 'g')) = $1
           )
         )
       LIMIT 1`,
      [normalized]
    );
    return result.rows[0] ? mapMaterial(result.rows[0]) : null;
  }

  async lockById(client: DbClient, id: string): Promise<void> {
    await client.query("SELECT id FROM materials WHERE id = $1 FOR UPDATE", [id]);
  }
}
