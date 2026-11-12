import { access } from "node:fs/promises";
import path from "node:path";

const failures = [];
const required = [
  "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL", "CRON_SECRET", "REDIS_URL",
  "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY", "OBJECT_STORAGE_PUBLIC_BASE_URL",
  "MYSQL_BIN_DIR", "BACKUP_DIRECTORY",
];

for (const name of required) if (!process.env[name]?.trim()) failures.push(`${name} is required.`);
if (process.env.NODE_ENV !== "production") failures.push("NODE_ENV must be production.");

function url(name) {
  try { return new URL(process.env[name] || ""); }
  catch { failures.push(`${name} must be a valid URL.`); return null; }
}

const database = url("DATABASE_URL");
if (database && database.protocol !== "mysql:") failures.push("DATABASE_URL must use mysql://.");
if (database && ["root", "admin"].includes(decodeURIComponent(database.username).toLowerCase())) failures.push("DATABASE_URL must use a least-privilege application account, not root/admin.");
const authUrl = url("NEXTAUTH_URL");
if (authUrl && authUrl.protocol !== "https:") failures.push("NEXTAUTH_URL must use HTTPS.");
const siteUrl = url("NEXT_PUBLIC_SITE_URL");
if (siteUrl && siteUrl.protocol !== "https:") failures.push("NEXT_PUBLIC_SITE_URL must use HTTPS.");
if (authUrl && siteUrl && authUrl.origin !== siteUrl.origin) failures.push("NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL must use the same canonical origin.");
const redisUrl = url("REDIS_URL");
if (redisUrl && redisUrl.protocol !== "rediss:" && !["localhost", "127.0.0.1", "::1"].includes(redisUrl.hostname)) failures.push("Remote REDIS_URL must use rediss://.");
for (const name of ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_PUBLIC_BASE_URL"]) {
  const parsed = url(name);
  if (parsed && parsed.protocol !== "https:") failures.push(`${name} must use HTTPS.`);
}
for (const name of ["NEXTAUTH_SECRET", "CRON_SECRET"]) if ((process.env[name] || "").length < 32) failures.push(`${name} must contain at least 32 characters.`);
if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET === process.env.CRON_SECRET) failures.push("NEXTAUTH_SECRET and CRON_SECRET must be distinct.");
if (process.env.ADMIN_PASSWORD) failures.push("Remove temporary ADMIN_PASSWORD after initial administrator creation.");

for (const file of [path.join(process.cwd(), ".next", "BUILD_ID"), path.join(process.env.MYSQL_BIN_DIR || "", process.platform === "win32" ? "mysqldump.exe" : "mysqldump")]) {
  try { await access(file); } catch { failures.push(`Required production artifact is missing: ${file}`); }
}

if (failures.length) {
  console.error(JSON.stringify({ status: "failed", checks: failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "passed", checks: required.length + 10, message: "No secret values were printed." }, null, 2));
}
