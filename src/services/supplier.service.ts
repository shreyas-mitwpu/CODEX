import { pool } from "../database/pool";
import type { SupplierRecommendation } from "../domain/types";
import { NotFoundError } from "../errors/app-error";
import { MaterialRepository } from "../repositories/material.repository";
import { SupplierRepository } from "../repositories/supplier.repository";

export class SupplierService {
  constructor(
    private readonly materials = new MaterialRepository(),
    private readonly suppliers = new SupplierRepository()
  ) {}

  async recommend(
    materialQuery: string
  ): Promise<{ materialName: string; recommendation: SupplierRecommendation }> {
    const material = await this.materials.findByNameOrAlias(pool, materialQuery);
    if (!material) throw new NotFoundError(`Unknown material: ${materialQuery}`);
    const recommendation = await this.suppliers.findFastestForMaterial(pool, material.id);
    if (!recommendation) {
      throw new NotFoundError(`No active supplier configured for ${material.name}`);
    }
    return { materialName: material.name, recommendation };
  }
}
