/**
 * Repairs a local development database that was created while MySQL's default
 * engine was MyISAM (WAMP ships with `default_storage_engine=MYISAM`).
 * MyISAM silently ignores foreign keys and transactions, so the schema the app
 * relies on was never enforced.
 *
 *   npm run db:repair-local            → report only, changes nothing
 *   npm run db:repair-local -- --apply → make the changes
 *
 * With --apply it:
 *   1. removes rows whose parent row no longer exists (they would block the foreign keys)
 *   2. removes leftovers from interrupted integration tests ("CRUD Test …")
 *   3. converts every table to InnoDB
 *   4. creates the foreign keys defined in prisma/schema.prisma
 *
 * Take a backup first: MYSQL_BIN_DIR=<mysql bin> npm run backup:mysql
 */
import { execFileSync } from "node:child_process";

import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";

config({ path: [".env.local", ".env"], quiet: true });

const apply = process.argv.includes("--apply");
if (process.env.NODE_ENV === "production") throw new Error("This script is for local development databases only.");

const db = new PrismaClient({ adapter: createDatabaseAdapter() });
const count = (rows: { n: bigint | number }[]) => Number(rows[0]?.n ?? 0);

type ForeignKey = { sql: string; table: string; column: string; parent: string; parentColumn: string; onDelete: string };

/** Foreign keys the schema defines but the database lacks, from `prisma migrate diff`. */
function missingForeignKeys(): ForeignKey[] {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const script = execFileSync(npx, ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const pattern = /ALTER TABLE `(\w+)` ADD CONSTRAINT `\w+` FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)`\(`(\w+)`\) ON DELETE (SET NULL|CASCADE|RESTRICT|NO ACTION)[^;]*;/g;
  const keys = [...script.matchAll(pattern)].map((m) => ({ sql: m[0], table: m[1], column: m[2], parent: m[3], parentColumn: m[4], onDelete: m[5] }));
  const other = script.replace(pattern, "").replace(/--.*$/gm, "").trim();
  if (other) console.warn("Note: the schema diff also contains changes this script does not apply:\n" + other);
  return keys;
}

async function main() {
  const engine = await db.$queryRawUnsafe<{ e: string }[]>("SELECT @@default_storage_engine AS e");
  const myisam = (await db.$queryRawUnsafe<{ t: string }[]>(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND ENGINE <> 'InnoDB'",
  )).map((row) => row.t);
  const keys = missingForeignKeys();

  console.log(`Server default engine: ${engine[0]?.e}`);
  console.log(`Tables not using InnoDB: ${myisam.length}`);
  console.log(`Missing foreign keys: ${keys.length}`);

  // Orphans block foreign key creation. SET NULL / CASCADE follow the schema's own rule.
  const orphanFixes: { key: ForeignKey; orphans: number }[] = [];
  for (const key of keys) {
    const where = `c.\`${key.column}\` IS NOT NULL AND p.\`${key.parentColumn}\` IS NULL`;
    const join = `\`${key.table}\` c LEFT JOIN \`${key.parent}\` p ON p.\`${key.parentColumn}\` = c.\`${key.column}\``;
    const orphans = count(await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM ${join} WHERE ${where}`));
    if (orphans) {
      orphanFixes.push({ key, orphans });
      console.log(`  ${orphans} row(s) in ${key.table}.${key.column} point to a missing ${key.parent} (rule: ${key.onDelete})`);
    }
  }
  const blocked = orphanFixes.filter(({ key }) => key.onDelete === "RESTRICT" || key.onDelete === "NO ACTION");
  if (blocked.length) {
    throw new Error(`Cannot repair automatically: ${blocked.map(({ key }) => `${key.table}.${key.column}`).join(", ")} has orphaned rows under a RESTRICT rule. Fix them by hand first.`);
  }

  const testJobs = count(await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM jobs WHERE title LIKE 'CRUD Test Job %'"));
  const testCompanies = count(await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM companies WHERE name LIKE 'CRUD Test Company %'"));
  console.log(`Leftover test records: ${testJobs} job(s), ${testCompanies} compan(ies)`);

  if (!apply) {
    console.log("\nReport only. Run `npm run db:repair-local -- --apply` to make these changes.");
    return;
  }

  for (const { key } of orphanFixes) {
    const join = `\`${key.table}\` c LEFT JOIN \`${key.parent}\` p ON p.\`${key.parentColumn}\` = c.\`${key.column}\``;
    const where = `c.\`${key.column}\` IS NOT NULL AND p.\`${key.parentColumn}\` IS NULL`;
    const changed = key.onDelete === "CASCADE"
      ? await db.$executeRawUnsafe(`DELETE c FROM ${join} WHERE ${where}`)
      : await db.$executeRawUnsafe(`UPDATE ${join} SET c.\`${key.column}\` = NULL WHERE ${where}`);
    console.log(`Fixed ${changed} orphaned row(s) in ${key.table}.${key.column}`);
  }

  await db.$executeRawUnsafe("DELETE FROM jobs WHERE title LIKE 'CRUD Test Job %'");
  await db.$executeRawUnsafe("DELETE c FROM companies c LEFT JOIN jobs j ON j.companyId = c.id WHERE c.name LIKE 'CRUD Test Company %' AND j.id IS NULL");

  for (const table of myisam) {
    await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ENGINE=InnoDB`);
    console.log(`Converted ${table} to InnoDB`);
  }
  for (const key of keys) await db.$executeRawUnsafe(key.sql);
  console.log(`Created ${keys.length} foreign key(s).`);

  const remaining = missingForeignKeys().length;
  console.log(remaining ? `Warning: ${remaining} foreign key(s) still missing.` : "Database now matches the schema.");
  if (engine[0]?.e?.toUpperCase() !== "INNODB") {
    console.log("\nAlso change `default_storage_engine=MYISAM` to `default_storage_engine=InnoDB` in your MySQL my.ini and restart MySQL, or new tables will be MyISAM again.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
