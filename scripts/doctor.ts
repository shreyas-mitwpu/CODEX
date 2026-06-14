import { env } from "../src/config/env";
import { pool } from "../src/database/pool";

interface CheckResult {
  name: string;
  ok: boolean;
  details?: string;
}

async function main(): Promise<void> {
  const checks: CheckResult[] = [];
  checks.push(check("Runtime", true, `NODE_ENV=${env.NODE_ENV}, PORT=${env.PORT}`));
  checks.push(check("Public URL", /^https:\/\//.test(env.PUBLIC_BASE_URL), env.PUBLIC_BASE_URL));
  checks.push(
    check(
      "WhatsApp sender",
      env.TWILIO_WHATSAPP_FROM.startsWith("whatsapp:+"),
      env.TWILIO_WHATSAPP_FROM
    )
  );
  checks.push(check("Claude model", env.ANTHROPIC_MODEL.length > 0, env.ANTHROPIC_MODEL));

  try {
    await pool.query("SELECT 1");
    checks.push(check("Database connection", true));
  } catch (error) {
    checks.push(check("Database connection", false, errorMessage(error)));
  }

  try {
    const migrations = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'schema_migrations'`
    );
    if (migrations.rows[0]?.count === "1") {
      const applied = await pool.query<{ name: string }>(
        "SELECT name FROM schema_migrations ORDER BY name"
      );
      checks.push(
        check(
          "Migrations table",
          applied.rows.length > 0,
          applied.rows.map((row) => row.name).join(", ") || "No migrations applied"
        )
      );
    } else {
      checks.push(check("Migrations table", false, "Run npm run db:migrate"));
    }
  } catch (error) {
    checks.push(check("Migrations table", false, errorMessage(error)));
  }

  try {
    const users = await pool.query<{ owners: string; active_users: string }>(
      `SELECT
         count(*) FILTER (WHERE role = 'OWNER' AND is_active)::text AS owners,
         count(*) FILTER (WHERE is_active)::text AS active_users
       FROM users`
    );
    const row = users.rows[0];
    const owners = Number(row?.owners ?? 0);
    const activeUsers = Number(row?.active_users ?? 0);
    checks.push(
      check(
        "Registered users",
        owners > 0 && activeUsers > 0,
        `${activeUsers} active users, ${owners} owners`
      )
    );
  } catch (error) {
    checks.push(check("Registered users", false, errorMessage(error)));
  }

  try {
    const materials = await pool.query<{ materials: string; supplier_links: string }>(
      `SELECT
         (SELECT count(*)::text FROM materials WHERE is_active) AS materials,
         (SELECT count(*)::text FROM supplier_materials) AS supplier_links`
    );
    const row = materials.rows[0];
    const materialCount = Number(row?.materials ?? 0);
    const supplierLinks = Number(row?.supplier_links ?? 0);
    checks.push(
      check(
        "Materials and suppliers",
        materialCount > 0 && supplierLinks > 0,
        `${materialCount} materials, ${supplierLinks} supplier links`
      )
    );
  } catch (error) {
    checks.push(check("Materials and suppliers", false, errorMessage(error)));
  }

  for (const result of checks) {
    const marker = result.ok ? "OK" : "FAIL";
    console.log(`${marker.padEnd(4)} ${result.name}${result.details ? ` - ${result.details}` : ""}`);
  }

  await pool.end();

  if (checks.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

function check(name: string, ok: boolean, details?: string): CheckResult {
  return { name, ok, ...(details ? { details } : {}) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

main().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
