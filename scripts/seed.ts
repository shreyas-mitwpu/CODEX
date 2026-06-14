import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../src/database/pool";

async function main(): Promise<void> {
  const sql = await readFile(resolve("database/seed.sql"), "utf8");
  await pool.query(sql);
  console.log("Database seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
