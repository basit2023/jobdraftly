import { describe, expect, it } from "vitest";

import { POST as expireJobs } from "@/app/api/cron/expire-jobs/route";
import { POST as monitorSources } from "@/app/api/cron/monitor-sources/route";

describe("scheduled API authorization", () => {
  it("rejects missing bearer credentials", async () => {
    const [expirationResponse, monitoringResponse] = await Promise.all([
      expireJobs(new Request("http://localhost/api/cron/expire-jobs", { method: "POST" })),
      monitorSources(new Request("http://localhost/api/cron/monitor-sources", { method: "POST" })),
    ]);
    expect(expirationResponse.status).toBe(401);
    expect(monitoringResponse.status).toBe(401);
  });

  it("rejects a wrong bearer credential without leaking configured secrets", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "phase9-correct-secret";
    try {
      const response = await monitorSources(new Request("http://localhost/api/cron/monitor-sources", {
        method: "POST",
        headers: { Authorization: "Bearer phase9-wrong-secret" },
      }));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
});
