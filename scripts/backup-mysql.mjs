import { createBackup, notifyBackupFailure } from "./mysql-backup-lib.mjs";

try {
  const archive = await createBackup();
  console.log(JSON.stringify({ status: "completed", archive, timestamp: new Date().toISOString() }));
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : "Backup failed" }));
  await notifyBackupFailure(error).catch(() => undefined);
  process.exitCode = 1;
}
