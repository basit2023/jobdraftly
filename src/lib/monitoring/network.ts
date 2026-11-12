import "server-only";

import { assertPublicSourceUrl } from "@/lib/imports/network";

import { robotsAllows } from "./robots-policy";

const USER_AGENT = "JobDraftly/1.0 (+https://www.jobdraftly.com)";
const MAX_MONITOR_BYTES = 5 * 1024 * 1024;

export async function assertRobotsPermission(endpoint: string) {
  const url = await assertPublicSourceUrl(endpoint);
  const robotsUrl = new URL("/robots.txt", url.origin);
  const response = await fetch(robotsUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/plain" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`Robots policy could not be verified (HTTP ${response.status}); scan stopped.`);
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > 256 * 1024) {
    throw new Error("Robots policy exceeds the safe processing limit.");
  }
  if (!robotsAllows(body, `${url.pathname}${url.search}`)) {
    throw new Error("Source robots policy does not allow JobDraftly to monitor this path.");
  }
}

export async function fetchMonitoredSource(input: {
  endpoint: string;
  etag: string | null;
  lastModified: string | null;
}) {
  const url = await assertPublicSourceUrl(input.endpoint);
  const headers = new Headers({
    "User-Agent": USER_AGENT,
    Accept: "application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9",
  });
  if (input.etag) headers.set("If-None-Match", input.etag);
  if (input.lastModified) headers.set("If-Modified-Since", input.lastModified);

  const response = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 304) {
    return {
      status: 304,
      body: "",
      contentType: response.headers.get("content-type") ?? "",
      etag: response.headers.get("etag") ?? input.etag,
      lastModified: response.headers.get("last-modified") ?? input.lastModified,
    };
  }
  if (!response.ok) throw new Error(`Source responded with HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_MONITOR_BYTES) throw new Error("Source response exceeds the 5 MB monitoring limit.");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_MONITOR_BYTES) {
    throw new Error("Source response exceeds the 5 MB monitoring limit.");
  }
  return {
    status: response.status,
    body,
    contentType: response.headers.get("content-type") ?? "",
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}
