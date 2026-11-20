import { describe, expect, it, vi } from "vitest";

import { validateImage } from "@/lib/security/image-validation";
import { rateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { hasSameOrigin } from "@/lib/security/request";

function png(width: number, height: number) {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0], 33);
  return bytes;
}

describe("security boundaries", () => {
  it("enforces a bounded fixed-window rate limit", async () => {
    resetRateLimitsForTests();
    expect((await rateLimit("login:a", 2, 60_000, 1_000)).allowed).toBe(true);
    expect((await rateLimit("login:a", 2, 60_000, 1_001)).allowed).toBe(true);
    expect(await rateLimit("login:a", 2, 60_000, 1_002)).toMatchObject({ allowed: false, remaining: 0 });
    expect((await rateLimit("login:a", 2, 60_000, 61_001)).allowed).toBe(true);
  });

  it("rejects cross-origin custom API mutations", () => {
    expect(hasSameOrigin(new Request("https://jobdraftly.com/api/admin/test", { headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(hasSameOrigin(new Request("https://jobdraftly.com/api/admin/test", { headers: { origin: "https://jobdraftly.com" } }))).toBe(true);
  });

  it("accepts the public origin behind the trusted reverse proxy", () => {
    const request = new Request("https://127.0.0.1:3100/api/jobs/job_123/apply", {
      method: "POST",
      headers: {
        origin: "https://jobdraftly.com",
        "x-forwarded-host": "jobdraftly.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(hasSameOrigin(request)).toBe(true);
  });

  it("accepts the configured public origin when Next.js exposes its loopback URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://jobdraftly.com");
    try {
      const request = new Request("https://127.0.0.1:3100/api/jobs/job_123/apply", {
        method: "POST",
        headers: { origin: "https://jobdraftly.com" },
      });
      expect(hasSameOrigin(request)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not let proxy metadata authorize a different browser origin", () => {
    const request = new Request("https://127.0.0.1:3100/api/admin/test", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "x-forwarded-host": "jobdraftly.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(hasSameOrigin(request)).toBe(false);
  });

  it("accepts the live site when HTTPS ends before nginx (proxy reports http)", () => {
    // Cloudflare / hosting panel terminates TLS; nginx passes Host and X-Forwarded-Proto: http.
    const request = new Request("http://127.0.0.1:3100/api/jobs/job_123/apply", {
      method: "POST",
      headers: { origin: "https://jobdraftly.com", host: "jobdraftly.com", "x-forwarded-proto": "http" },
    });
    expect(hasSameOrigin(request)).toBe(true);
  });

  it("accepts the live site when nginx only passes Host (no X-Forwarded-Host)", () => {
    const request = new Request("http://127.0.0.1:3100/api/jobs/job_123/apply", {
      method: "POST",
      headers: { origin: "https://jobdraftly.com", host: "jobdraftly.com:443" },
    });
    expect(hasSameOrigin(request)).toBe(true);
  });

  it("accepts both www and non-www forms of the configured site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jobdraftly.com");
    try {
      for (const origin of ["https://jobdraftly.com", "https://www.jobdraftly.com"]) {
        const request = new Request("http://127.0.0.1:3100/api/jobs/job_123/apply", { method: "POST", headers: { origin } });
        expect(hasSameOrigin(request)).toBe(true);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still rejects other sites, look-alike hosts and sandboxed pages", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.jobdraftly.com");
    try {
      for (const origin of ["https://evil.example", "https://jobdraftly.com.evil.example", "https://evil-jobdraftly.com", "https://evil.jobdraftly.com", "null", "javascript:alert(1)"]) {
        const request = new Request("http://127.0.0.1:3100/api/jobs/job_123/apply", { method: "POST", headers: { origin, host: "jobdraftly.com" } });
        expect(hasSameOrigin(request), origin).toBe(false);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("validates image type, dimensions, and structure", () => {
    expect(validateImage(png(400, 200), "image/png")).toMatchObject({ extension: "png", width: 400, height: 200 });
    expect(validateImage(png(400, 200), "image/jpeg")).toBeNull();
    expect(validateImage(png(5_000, 200), "image/png")).toBeNull();
    expect(validateImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBeNull();
  });
});
