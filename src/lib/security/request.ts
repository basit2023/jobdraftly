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

/** "jobdraftly.com", "localhost:3000" … lower-cased, without a default :80/:443 port. */
function normalizeHost(value: string | null | undefined) {
  const host = value?.split(",", 1)[0]?.trim().toLowerCase();
  if (!host || /[\s/@]/.test(host)) return null;
  return host.replace(/:(80|443)$/, "");
}

function hostOfUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? normalizeHost(url.host) : null;
  } catch {
    return null;
  }
}

/** www.example.com ⇄ example.com, so both forms of the public site are accepted. */
function withWwwTwin(host: string) {
  return host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
}

/**
 * Blocks cross-site form posts (CSRF) to our own API routes.
 *
 * Compares the browser's Origin HOST with the host the browser actually requested.
 * The scheme (http/https) is deliberately not compared: behind nginx, Cloudflare or a
 * hosting panel, TLS often ends before the app, so the app sees http while the
 * browser sent https. That mismatch used to reject genuine requests with 403.
 * A page on another site can never make the browser send our host as its Origin,
 * so the host alone is what matters.
 */
export function hasSameOrigin(request: Request) {
  // Non-browser clients may omit Origin. Authentication and endpoint-specific
  // authorization still apply to protected mutations.
  if (!request.headers.has("origin")) return true;
  const originHost = hostOfUrl(request.headers.get("origin")); // "null" (sandboxed pages) → rejected
  if (!originHost) return false;

  const allowed = new Set<string>();
  // What the browser connected to: Host (nginx "proxy_set_header Host $host"),
  // X-Forwarded-Host, and the URL Next.js built for this request.
  for (const host of [
    normalizeHost(request.headers.get("host")),
    normalizeHost(request.headers.get("x-forwarded-host")),
    hostOfUrl(request.url),
  ]) {
    if (host) allowed.add(host);
  }
  // The configured public site, with and without www.
  for (const value of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL]) {
    const host = hostOfUrl(value);
    if (host) for (const twin of withWwwTwin(host)) allowed.add(twin);
  }

  return allowed.has(originHost);
}
