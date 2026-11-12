import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function isPrivateIp(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

export async function assertPublicSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Approved API and RSS endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in a source URL.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("Private and local network source URLs are not allowed.");
  return url;
}

export async function fetchApprovedSource(value: string) {
  const url = await assertPublicSourceUrl(value);
  const response = await fetch(url, { headers: { "User-Agent": "JobDraftly/1.0 (+https://www.jobdraftly.com)" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Source responded with HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 2 * 1024 * 1024) throw new Error("Source response exceeds the 2 MB limit.");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > 2 * 1024 * 1024) throw new Error("Source response exceeds the 2 MB limit.");
  return { body, contentType: response.headers.get("content-type") ?? "" };
}

