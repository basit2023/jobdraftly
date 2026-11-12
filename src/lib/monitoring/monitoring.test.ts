import { describe, expect, it } from "vitest";

import { canonicalizeDiscoveryUrl, classifyDiscovery, discoverContent } from "./discovery";
import { robotsAllows } from "./robots-policy";
import { classifyDiscoveryChange } from "./runner";
import type { DiscoveryCandidate } from "./types";

describe("authorized source monitoring", () => {
  it("normalizes API discoveries and detects job records", () => {
    const discoveries = discoverContent({
      mode: "API",
      endpoint: "https://source.example.invalid/api/jobs",
      body: JSON.stringify({
        jobs: [{
          id: "JOB-42",
          title: "Software Engineer Vacancy",
          url: "/jobs/42?utm_source=test",
          description: "Development fixture only.",
          deadline: "2026-12-31",
        }],
      }),
    });
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]).toMatchObject({
      externalId: "JOB-42",
      canonicalUrl: "https://source.example.invalid/jobs/42",
      type: "JOB",
    });
    expect(discoveries[0]?.deadline?.toISOString()).toContain("2026-12-31");
  });

  it("discovers permitted-page documents without treating them as published jobs", () => {
    const discoveries = discoverContent({
      mode: "WEB_PAGE",
      endpoint: "https://source.example.invalid/careers",
      body: '<html><a href="/documents/interview-list.pdf">Interview candidate list</a></html>',
    });
    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]?.type).toBe("DOCUMENT");
    expect(discoveries[0]?.documents[0]).toMatchObject({ mimeType: "application/pdf" });
  });

  it("classifies announcements conservatively", () => {
    expect(classifyDiscovery("Written test schedule")).toBe("TEST_INTERVIEW");
    expect(classifyDiscovery("Final merit list")).toBe("RESULT_MERIT_LIST");
    expect(classifyDiscovery("Deadline extended for recruitment")).toBe("ANNOUNCEMENT");
  });

  it("honors the longest matching robots rule", () => {
    const policy = "User-agent: *\nDisallow: /careers\nAllow: /careers/public\n";
    expect(robotsAllows(policy, "/careers/private")).toBe(false);
    expect(robotsAllows(policy, "/careers/public/jobs")).toBe(true);
  });

  it("removes tracking parameters from canonical source URLs", () => {
    expect(canonicalizeDiscoveryUrl("/job/1?b=2&utm_campaign=x&a=1#details", "https://source.example.invalid")).toBe("https://source.example.invalid/job/1?a=1&b=2");
  });
});

describe("source change classification", () => {
  const candidate = (overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
    externalId: "qa-1",
    canonicalUrl: "https://example.invalid/jobs/qa-1",
    title: "QA Test Vacancy",
    summary: null,
    type: "JOB",
    publishedAt: null,
    deadline: null,
    documents: [],
    rawPayload: {},
    ...overrides,
  });

  it("prioritizes a deadline extension described in a corrigendum", () => {
    expect(classifyDiscoveryChange(
      { status: "UPDATED", deadline: new Date("2026-12-01T18:59:59.000Z") },
      candidate({ title: "Corrigendum - deadline extended", deadline: new Date("2026-12-18T18:59:59.000Z") }),
    )).toBe("DEADLINE_CHANGED");
  });

  it("detects cancellation, restoration, and ordinary corrections", () => {
    expect(classifyDiscoveryChange({ status: "UPDATED", deadline: null }, candidate({ summary: "Recruitment cancelled" }))).toBe("CANCELLED");
    expect(classifyDiscoveryChange({ status: "REMOVED", deadline: null }, candidate())).toBe("RESTORED");
    expect(classifyDiscoveryChange({ status: "UPDATED", deadline: null }, candidate({ title: "Corrigendum notice" }))).toBe("CORRECTION");
  });
});
