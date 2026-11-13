import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { access, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createGunzip, createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

function executable(name) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  if (!process.env.MYSQL_BIN_DIR) return `${name}${suffix}`;
  const preferred = path.join(process.env.MYSQL_BIN_DIR, `${name}${suffix}`);
  if (name === "mysqldump" && process.platform !== "win32" && !existsSync(preferred)) {
    const mariaDbDump = path.join(process.env.MYSQL_BIN_DIR, "mariadb-dump");
    if (existsSync(mariaDbDump)) return mariaDbDump;
  }
  return preferred;
}

export function databaseConfig(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://.");
  const database = parsed.pathname.replace(/^\//, "");
  if (!database || !/^[A-Za-z0-9_]+$/.test(database)) throw new Error("DATABASE_URL contains an unsafe database name.");
  return { host: parsed.hostname, port: parsed.port || "3306", user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), database };
}

export async function run(command, args, config, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: options.stdio || ["ignore", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code}.`)));
  });
}

export async function createBackup() {
  const config = databaseConfig();
  const directory = path.resolve(process.env.BACKUP_DIRECTORY || path.join(process.cwd(), "backups"));
  await mkdir(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sqlPath = path.join(directory, `${config.database}-${timestamp}.sql`);
  const gzipPath = `${sqlPath}.gz`;
  const dump = executable("mysqldump");
  if (process.env.MYSQL_BIN_DIR) await access(dump);
  try {
    await run(dump, [
      `--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`,
      "--single-transaction", "--quick", "--routines", "--events", "--triggers",
      "--hex-blob", "--set-gtid-purged=OFF", "--no-tablespaces", `--result-file=${sqlPath}`,
      config.database,
    ], config);
    await pipeline(createReadStream(sqlPath), createGzip({ level: 9 }), createWriteStream(gzipPath, { flags: "wx" }));
    const details = await stat(gzipPath);
    if (details.size < 100) throw new Error("Backup archive is unexpectedly small.");
  } finally {
    await rm(sqlPath, { force: true });
  }

  const retentionDays = Math.min(Math.max(Number(process.env.BACKUP_RETENTION_DAYS || 14), 1), 365);
  const cutoff = Date.now() - retentionDays * 86_400_000;
  for (const name of await readdir(directory)) {
    if (!name.startsWith(`${config.database}-`) || !name.endsWith(".sql.gz")) continue;
    const target = path.join(directory, name);
    if ((await stat(target)).mtimeMs < cutoff) await rm(target);
  }
  return gzipPath;
}

export async function restoreBackup(archivePath, targetDatabase) {
  if (!/^jobdraftly_restore_test_[0-9_]+$/.test(targetDatabase)) throw new Error("Restore target must be an isolated JobDraftly test database.");
  const config = databaseConfig();
  const mysql = executable("mysql");
  if (process.env.MYSQL_BIN_DIR) await access(mysql);
  await run(mysql, [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`, "--execute", `CREATE DATABASE \`${targetDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`], config);
  const child = spawn(mysql, [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`, targetDatabase], {
    windowsHide: true,
    env: { ...process.env, MYSQL_PWD: config.password },
    stdio: ["pipe", "inherit", "inherit"],
  });
  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`mysql restore exited with code ${code}.`)));
  });
  await pipeline(createReadStream(archivePath), createGunzip(), child.stdin);
  await exit;
}

export async function dropRestoreDatabase(targetDatabase) {
  if (!/^jobdraftly_restore_test_[0-9_]+$/.test(targetDatabase)) throw new Error("Refusing to drop a non-test database.");
  const config = databaseConfig();
  await run(executable("mysql"), [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`, "--execute", `DROP DATABASE IF EXISTS \`${targetDatabase}\``], config);
}

export async function notifyBackupFailure(error) {
  const endpoint = process.env.BACKUP_FAILURE_WEBHOOK_URL?.trim();
  if (!endpoint) return;
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: "jobdraftly", event: "database_backup_failed", message: error instanceof Error ? error.message : "Backup failed", timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000),
  });
}
