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

  it("validates image type, dimensions, and structure", () => {
    expect(validateImage(png(400, 200), "image/png")).toMatchObject({ extension: "png", width: 400, height: 200 });
    expect(validateImage(png(400, 200), "image/jpeg")).toBeNull();
    expect(validateImage(png(5_000, 200), "image/png")).toBeNull();
    expect(validateImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBeNull();
  });
});
