import { describe, expect, it } from "vitest";

import { nextRetryAt } from "@/lib/monitoring/runner";

describe("background retry policy", () => {
  it("backs off repeated source failures and caps the delay", () => {
    const now = new Date("2026-11-11T00:00:00.000Z");
    expect(nextRetryAt({ monitoringIntervalMinutes: 10, consecutiveFailures: 0 }, now).toISOString()).toBe("2026-11-11T00:10:00.000Z");
    expect(nextRetryAt({ monitoringIntervalMinutes: 10, consecutiveFailures: 3 }, now).toISOString()).toBe("2026-11-11T01:20:00.000Z");
    expect(nextRetryAt({ monitoringIntervalMinutes: 10_000, consecutiveFailures: 9 }, now).getTime() - now.getTime()).toBe(43_200 * 60_000);
  });
});
