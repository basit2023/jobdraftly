import "server-only";

export function requestIp(headers?: Headers | Record<string, string | string[] | undefined>) {
  const read = (name: string) => {
    if (!headers) return undefined;
    if (headers instanceof Headers) return headers.get(name);
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  const forwarded = read("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || read("x-real-ip")?.trim() || "unknown";
}

function httpOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function hasSameOrigin(request: Request) {
  const origin = httpOrigin(request.headers.get("origin"));
  // Non-browser clients may omit Origin. Authentication and endpoint-specific
  // authorization still apply to protected mutations.
  if (!request.headers.has("origin")) return true;
  if (!origin) return false;

  const allowedOrigins = new Set<string>();
  for (const value of [request.url, process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL]) {
    const allowed = httpOrigin(value);
    if (allowed) allowedOrigins.add(allowed);
  }

  // Nginx/Apache must overwrite both headers at the trusted proxy boundary.
  // This preserves the browser-facing origin when Next.js runs on loopback.
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  if ((forwardedProto === "http" || forwardedProto === "https") && forwardedHost) {
    const forwardedOrigin = httpOrigin(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) allowedOrigins.add(forwardedOrigin);
  }

  return allowedOrigins.has(origin);
}
