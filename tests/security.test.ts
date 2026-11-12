import { describe, expect, it } from "vitest";

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

  it("validates image type, dimensions, and structure", () => {
    expect(validateImage(png(400, 200), "image/png")).toMatchObject({ extension: "png", width: 400, height: 200 });
    expect(validateImage(png(400, 200), "image/jpeg")).toBeNull();
    expect(validateImage(png(5_000, 200), "image/png")).toBeNull();
    expect(validateImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBeNull();
  });
});
