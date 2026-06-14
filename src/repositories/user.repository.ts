import type { DbClient } from "../database/pool";
import type { UserRecord, UserRole } from "../domain/types";

interface UserRow {
  id: string;
  name: string;
  phone_number: string;
  role: UserRole;
  is_active: boolean;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
    role: row.role,
    isActive: row.is_active
  };
}

export class UserRepository {
  async findActiveById(client: DbClient, id: string): Promise<UserRecord | null> {
    const result = await client.query<UserRow>(
      `SELECT id, name, phone_number, role, is_active
       FROM users
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findActiveByPhone(client: DbClient, phone: string): Promise<UserRecord | null> {
    const result = await client.query<UserRow>(
      `SELECT id, name, phone_number, role, is_active
       FROM users
       WHERE phone_number = $1 AND is_active = true`,
      [phone]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async listActiveByRoles(client: DbClient, roles: UserRole[]): Promise<UserRecord[]> {
    const result = await client.query<UserRow>(
      `SELECT id, name, phone_number, role, is_active
       FROM users
       WHERE role = ANY($1::user_role[]) AND is_active = true
       ORDER BY role, name`,
      [roles]
    );
    return result.rows.map(mapUser);
  }
}
