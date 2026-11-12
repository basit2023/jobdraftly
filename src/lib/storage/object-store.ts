import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { assertPublicSourceUrl } from "@/lib/imports/network";
import { validateImage, type ValidImage } from "@/lib/security/image-validation";

type StoreInput = { key: string; body: Uint8Array; contentType: string };

/* ------------------------------------------------------------------ */
/* Cloudinary (preferred for images)                                   */
/* ------------------------------------------------------------------ */

type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string; folder: string };

/**
 * Reads either CLOUDINARY_URL (cloudinary://<key>:<secret>@<cloud>) or the three
 * separate CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET values.
 */
export function cloudinaryConfig(): CloudinaryConfig | null {
  const folder = (process.env.CLOUDINARY_FOLDER?.trim() || "jobdraftly").replace(/^\/+|\/+$/g, "");
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "cloudinary:" && parsed.username && parsed.password && parsed.hostname) {
        return {
          cloudName: parsed.hostname,
          apiKey: decodeURIComponent(parsed.username),
          apiSecret: decodeURIComponent(parsed.password),
          folder,
        };
      }
    } catch {
      // Fall through to the individual variables.
    }
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, folder };
}

/** Cloudinary signature: SHA-1 of the alphabetically sorted params joined with "&", plus the secret. */
export function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

async function uploadToCloudinary(config: CloudinaryConfig, input: StoreInput): Promise<string> {
  const safeKey = input.key.replaceAll("\\", "/").replace(/^\/+/, "");
  const directory = path.posix.dirname(safeKey);
  const publicId = path.posix.basename(safeKey, path.posix.extname(safeKey));
  const signed: Record<string, string> = {
    folder: directory === "." ? config.folder : `${config.folder}/${directory}`,
    overwrite: "false",
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1_000)),
  };

  const form = new FormData();
  for (const [key, value] of Object.entries(signed)) form.set(key, value);
  form.set("api_key", config.apiKey);
  form.set("signature", cloudinarySignature(signed, config.apiSecret));
  form.set("file", new Blob([input.body as BlobPart], { type: input.contentType }), path.posix.basename(safeKey));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!response.ok || !payload?.secure_url) {
    throw new Error(`Cloudinary upload failed: ${payload?.error?.message ?? `HTTP ${response.status}`}`);
  }
  return payload.secure_url;
}

/* ------------------------------------------------------------------ */
/* S3-compatible storage (fallback for non-image objects)              */
/* ------------------------------------------------------------------ */

function s3Config() {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim();
  const region = process.env.OBJECT_STORAGE_REGION?.trim();
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim();
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL?.trim();
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

export function objectStorageIsConfigured() {
  return Boolean(cloudinaryConfig() || s3Config());
}

/**
 * Stores a public file and returns its URL.
 * Order: Cloudinary (images) → S3-compatible bucket → local /public/uploads (development only).
 */
export async function storePublicObject(input: StoreInput) {
  const cloudinary = cloudinaryConfig();
  if (cloudinary && input.contentType.startsWith("image/")) {
    return uploadToCloudinary(cloudinary, input);
  }

  const config = s3Config();
  if (!config) {
    if (process.env.NODE_ENV === "production") throw new Error("Production object storage is not configured.");
    const safeKey = input.key.replaceAll("\\", "/").replace(/^\/+/, "");
    if (safeKey.includes("..")) throw new Error("Invalid object key.");
    const target = path.join(process.cwd(), "public", "uploads", safeKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body, { flag: "wx" });
    return `/uploads/${safeKey}`;
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: { upload: randomUUID() },
  }));
  return `${config.publicBaseUrl.replace(/\/$/, "")}/${input.key.split("/").map(encodeURIComponent).join("/")}`;
}

/* ------------------------------------------------------------------ */
/* Remote images found by the job pipeline                             */
/* ------------------------------------------------------------------ */

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<ValidImage["extension"], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Downloads a public image (logo or job advert), validates its real bytes, and
 * re-hosts it through storePublicObject (Cloudinary when configured).
 * Returns null instead of throwing when the image is unusable.
 */
export async function rehostRemoteImage(remoteUrl: string, folder: "company-logos" | "job-images"): Promise<string | null> {
  try {
    const url = await assertPublicSourceUrl(remoteUrl);
    const response = await fetch(url, {
      headers: { "User-Agent": "JobDraftly/1.0 (+https://www.jobdraftly.com)", Accept: "image/png,image/jpeg,image/webp" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    if (Number(response.headers.get("content-length") ?? 0) > MAX_REMOTE_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;

    // Trust the bytes, not the server's header: detect the format first, then validate against it.
    const sniffed = validateImage(bytes, "image/png") ?? validateImage(bytes, "image/jpeg") ?? validateImage(bytes, "image/webp");
    if (!sniffed) return null;
    return await storePublicObject({
      key: `${folder}/${randomUUID()}.${sniffed.extension}`,
      body: bytes,
      contentType: MIME_BY_EXTENSION[sniffed.extension],
    });
  } catch {
    return null;
  }
}
