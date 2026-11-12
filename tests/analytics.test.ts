import { describe, expect, it } from "vitest";

import { analyticsEventSchema } from "@/lib/validations/analytics";

describe("privacy-minimized launch analytics", () => {
  it("accepts an outbound application-link click but has no confirmed-application event", () => {
    expect(analyticsEventSchema.safeParse({ type: "APPLICATION_LINK_CLICK", jobId: "job_123", path: "/jobs/example" }).success).toBe(true);
    expect(analyticsEventSchema.safeParse({ type: "APPLICATION_CONFIRMED", jobId: "job_123", path: "/jobs/example" }).success).toBe(false);
  });

  it("tracks search usage without accepting raw search text or visitor identity", () => {
    expect(analyticsEventSchema.safeParse({ type: "SEARCH", path: "/jobs", locationSlug: "karachi", filterCount: 2, metadata: { hasKeyword: true, resultCount: 12 } }).success).toBe(true);
    expect(analyticsEventSchema.safeParse({ type: "SEARCH", path: "/jobs", searchTerm: "private query" }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ type: "SEARCH", path: "/jobs", ip: "127.0.0.1" }).success).toBe(false);
  });
});
