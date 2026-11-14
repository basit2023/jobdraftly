import { access } from "node:fs/promises";
import path from "node:path";

const failures = [];
const warnings = [];
const required = [
  "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL", "CRON_SECRET", "REDIS_URL",
  "MYSQL_BIN_DIR", "BACKUP_DIRECTORY",
];
const s3Variables = [
  "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY", "OBJECT_STORAGE_PUBLIC_BASE_URL",
];
const set = (name) => Boolean(process.env[name]?.trim());

for (const name of required) if (!set(name)) failures.push(`${name} is required.`);

// Uploaded images need public storage: Cloudinary, or a complete S3-compatible bucket.
const cloudinaryReady = set("CLOUDINARY_URL") || ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every(set);
const s3Ready = s3Variables.every(set);
if (!cloudinaryReady && !s3Ready) failures.push("Configure image storage: CLOUDINARY_URL (or the three CLOUDINARY_* keys), or all OBJECT_STORAGE_* variables.");
if (set("CLOUDINARY_URL") && !/^cloudinary:\/\/[^:]+:[^@]+@.+/.test(process.env.CLOUDINARY_URL)) failures.push("CLOUDINARY_URL must look like cloudinary://<key>:<secret>@<cloud name>.");

if (!set("OPENAI_API_KEY")) warnings.push("OPENAI_API_KEY is not set: discovered adverts will be stored but no jobs will be created from them.");
if (!set("NEXT_PUBLIC_CONTACT_EMAIL")) warnings.push("NEXT_PUBLIC_CONTACT_EMAIL is not set: the default fastsitecheck@gmail.com is used.");
if (!set("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION")) warnings.push("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is not set: add it to verify the site in Google Search Console.");
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
if (siteUrl && !siteUrl.hostname.includes(".")) failures.push("NEXT_PUBLIC_SITE_URL must use a fully qualified public hostname, for example https://jobdraftly.com.");
if (siteUrl && (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash)) failures.push("NEXT_PUBLIC_SITE_URL must contain only the canonical origin, with no path, query, or fragment.");
if (authUrl && siteUrl && authUrl.origin !== siteUrl.origin) failures.push("NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL must use the same canonical origin.");
const redisUrl = url("REDIS_URL");
if (redisUrl && redisUrl.protocol !== "rediss:" && !["localhost", "127.0.0.1", "::1"].includes(redisUrl.hostname)) failures.push("Remote REDIS_URL must use rediss://.");
for (const name of s3Ready ? ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_PUBLIC_BASE_URL"] : []) {
  const parsed = url(name);
  if (parsed && parsed.protocol !== "https:") failures.push(`${name} must use HTTPS.`);
}
for (const name of ["NEXTAUTH_SECRET", "CRON_SECRET"]) if ((process.env[name] || "").length < 32) failures.push(`${name} must contain at least 32 characters.`);
if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET === process.env.CRON_SECRET) failures.push("NEXTAUTH_SECRET and CRON_SECRET must be distinct.");
if (process.env.ADMIN_PASSWORD) failures.push("Remove temporary ADMIN_PASSWORD after initial administrator creation.");

const buildArtifact = path.join(process.cwd(), ".next", "BUILD_ID");
try { await access(buildArtifact); } catch { failures.push(`Required production artifact is missing: ${buildArtifact}`); }

const dumpDirectory = process.env.MYSQL_BIN_DIR || "";
const dumpCandidates = process.platform === "win32"
  ? [path.join(dumpDirectory, "mysqldump.exe")]
  : [path.join(dumpDirectory, "mysqldump"), path.join(dumpDirectory, "mariadb-dump")];
let dumpFound = false;
for (const candidate of dumpCandidates) {
  try { await access(candidate); dumpFound = true; break; } catch { /* Try the compatible MariaDB name. */ }
}
if (!dumpFound) failures.push(`A database dump utility is required. Checked: ${dumpCandidates.join(", ")}`);

if (failures.length) {
  console.error(JSON.stringify({ status: "failed", checks: failures, warnings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "passed", warnings, message: "No secret values were printed." }, null, 2));
}
