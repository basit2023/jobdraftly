import { createBackup, databaseConfig, dropRestoreDatabase, restoreBackup } from "./mysql-backup-lib.mjs";
import { spawn } from "node:child_process";
import path from "node:path";

const target = `jobdraftly_restore_test_${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const config = databaseConfig();
const mysql = process.env.MYSQL_BIN_DIR ? path.join(process.env.MYSQL_BIN_DIR, process.platform === "win32" ? "mysql.exe" : "mysql") : "mysql";

function scalar(database, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(mysql, [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`, "--batch", "--skip-column-names", "--execute", sql, database], {
      windowsHide: true, env: { ...process.env, MYSQL_PWD: config.password }, stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`mysql verification exited with code ${code}.`)));
  });
}

let archive;
try {
  archive = await createBackup();
  await restoreBackup(archive, target);
  const query = "SELECT CONCAT((SELECT COUNT(*) FROM _prisma_migrations),':',(SELECT COUNT(*) FROM job_categories),':',(SELECT COUNT(*) FROM job_locations),':',(SELECT COUNT(*) FROM jobs),':',(SELECT COUNT(*) FROM companies))";
  const original = await scalar(config.database, query);
  const restored = await scalar(target, query);
  if (original !== restored) throw new Error("Restored database verification counts do not match the source backup.");
  console.log(JSON.stringify({ status: "passed", archive, verification: "migration/category/location/job/company counts match", restoredDatabaseRemoved: true }));
} finally {
  await dropRestoreDatabase(target);
}
