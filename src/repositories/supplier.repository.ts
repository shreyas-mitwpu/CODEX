import type { DbClient } from "../database/pool";
import type { SupplierRecommendation } from "../domain/types";

interface SupplierRow {
  supplier_id: string;
  supplier_name: string;
  phone_number: string | null;
  lead_time_days: number;
  unit_price: string | null;
  currency: string;
}

export class SupplierRepository {
  async findFastestForMaterial(
    client: DbClient,
    materialId: string
  ): Promise<SupplierRecommendation | null> {
    const result = await client.query<SupplierRow>(
      `SELECT
         s.id AS supplier_id,
         s.name AS supplier_name,
         s.phone_number,
         sm.lead_time_days,
         sm.unit_price,
         sm.currency
       FROM supplier_materials sm
       JOIN suppliers s ON s.id = sm.supplier_id
       WHERE sm.material_id = $1 AND s.is_active = true
       ORDER BY sm.lead_time_days ASC, sm.is_preferred DESC, sm.unit_price ASC NULLS LAST
       LIMIT 1`,
      [materialId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      phoneNumber: row.phone_number,
      leadTimeDays: row.lead_time_days,
      unitPrice: row.unit_price === null ? null : Number(row.unit_price),
      currency: row.currency
    };
  }
}
