import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { endOfPakistanDay, findImageCandidates, htmlToText, MAX_ADVERT_CHARACTERS } from "./html";
import type { AiJob } from "./job-extractor";

vi.mock("@/lib/db", () => ({ db: {} }));

const { autoPublishBlockers } = await import("@/lib/monitoring/publisher");
const { cloudinaryConfig, cloudinarySignature } = await import("@/lib/storage/object-store");

const goodJob: AiJob = {
  isJobPosting: true,
  isClosedOrCancelled: false,
  title: "Assistant Director (BPS-17)",
  companyName: "Federal Public Service Commission",
  companyWebsite: null,
  description: "The commission is recruiting an Assistant Director to support policy and administration work in Islamabad. The role involves drafting, coordination and record keeping.",
  responsibilities: null,
  requirements: null,
  skills: [],
  employmentType: "FULL_TIME",
  experienceLevel: "MID_LEVEL",
  workplaceType: "ONSITE",
  education: "Master's degree",
  location: "Islamabad",
  category: "Government & Public Sector",
  salaryMin: null,
  salaryMax: null,
  salaryPeriod: null,
  applicationUrl: "https://www.fpsc.gov.pk/apply",
  applicationEmail: null,
  applicationDeadline: "2026-12-01",
  postedDate: null,
  companyLogoUrl: null,
  advertImageUrl: null,
  confidence: 0.93,
  notes: null,
};

describe("htmlToText", () => {
  it("drops scripts, navigation and tags but keeps line structure", () => {
    const { text, truncated } = htmlToText(`<html><head><style>p{}</style><script>alert(1)</script></head><body>
      <nav>Home | Jobs</nav><h1>Data Analyst</h1><p>Lahore &amp; Karachi</p><ul><li>SQL</li><li>Excel</li></ul></body></html>`);
    expect(truncated).toBe(false);
    expect(text).toContain("Data Analyst");
    expect(text).toContain("Lahore & Karachi");
    expect(text).toContain("• SQL");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("Home | Jobs");
  });

  it("flags pages longer than the model input limit", () => {
    const { text, truncated } = htmlToText(`<p>${"a".repeat(MAX_ADVERT_CHARACTERS + 50)}</p>`);
    expect(truncated).toBe(true);
    expect(text.length).toBe(MAX_ADVERT_CHARACTERS);
  });
});

describe("findImageCandidates", () => {
  it("returns absolute og:image and img URLs, skipping SVG and tracking pixels", () => {
    const html = `<meta property="og:image" content="/media/advert.jpg">
      <img src="logo.png"><img src="icon.svg"><img src="/px.gif" width="1" height="1"><img src="logo.png">`;
    expect(findImageCandidates(html, "https://jobs.example.pk/careers/1")).toEqual([
      "https://jobs.example.pk/media/advert.jpg",
      "https://jobs.example.pk/careers/logo.png",
    ]);
  });
});

describe("endOfPakistanDay", () => {
  it("treats a deadline as the end of that day in Pakistan", () => {
    expect(endOfPakistanDay("2026-12-01")?.toISOString()).toBe("2026-12-01T18:59:59.000Z");
    expect(endOfPakistanDay("01/12/2026")).toBeNull();
    expect(endOfPakistanDay(null)).toBeNull();
  });
});

describe("autoPublishBlockers", () => {
  const base = { hasLocation: true, hasCategory: true, applicationUrl: "https://www.fpsc.gov.pk/apply" };

  it("allows a confident, complete job from a trusted source", () => {
    expect(autoPublishBlockers({ ...base, source: { autoPublish: true }, job: goodJob })).toEqual([]);
  });

  it("never auto-publishes from an untrusted source", () => {
    expect(autoPublishBlockers({ ...base, source: { autoPublish: false }, job: goodJob })).toHaveLength(1);
  });

  it("holds back low-confidence or incomplete extractions", () => {
    const blockers = autoPublishBlockers({
      ...base,
      hasCategory: false,
      source: { autoPublish: true },
      job: { ...goodJob, confidence: 0.4, description: "Short." },
    });
    expect(blockers.join(" ")).toMatch(/confidence/);
    expect(blockers.join(" ")).toMatch(/Description/);
    expect(blockers.join(" ")).toMatch(/Category/);
  });
});

describe("Cloudinary configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads CLOUDINARY_URL", () => {
    vi.stubEnv("CLOUDINARY_URL", "cloudinary://123456:s3cr%3Dt@demo-cloud");
    expect(cloudinaryConfig()).toEqual({ cloudName: "demo-cloud", apiKey: "123456", apiSecret: "s3cr=t", folder: "jobdraftly" });
  });

  it("reads the separate variables when no URL is set", () => {
    vi.stubEnv("CLOUDINARY_URL", "");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
    vi.stubEnv("CLOUDINARY_FOLDER", "/site/");
    expect(cloudinaryConfig()).toEqual({ cloudName: "demo", apiKey: "key", apiSecret: "secret", folder: "site" });
  });

  it("signs sorted parameters the way Cloudinary expects", () => {
    const expected = createHash("sha1").update("folder=a&public_id=b&timestamp=1secret").digest("hex");
    expect(cloudinarySignature({ timestamp: "1", public_id: "b", folder: "a" }, "secret")).toBe(expected);
  });
});

describe("original advert wording", async () => {
  const { verbatimShare } = await import("./html");
  const { originalWordingShare, MIN_VERBATIM_SHARE } = await import("@/lib/monitoring/publisher");
  const advert = "Applications are invited for the post of Assistant (BPS-15).\n• Bachelor's degree (second division)\n• Age 18–30 years";

  it("accepts text copied word for word, ignoring bullets, case and line breaks", () => {
    expect(verbatimShare("applications are invited for the post of ASSISTANT (BPS-15). Bachelor's degree (second division)", advert)).toBe(1);
  });

  it("rejects reworded text", () => {
    expect(verbatimShare("We are looking for a motivated Assistant to join our government office team.", advert)).toBeLessThan(MIN_VERBATIM_SHARE);
  });

  it("skips the check when there is no page text (PDF or image adverts)", () => {
    expect(originalWordingShare({ description: "anything", responsibilities: null, requirements: null }, null)).toBeNull();
  });

  it("holds back auto-publishing when the wording was rewritten", () => {
    const blockers = autoPublishBlockers({ source: { autoPublish: true }, job: goodJob, hasLocation: true, hasCategory: true, applicationUrl: "https://example.com", wordingShare: 0.4 });
    expect(blockers.join(" ")).toMatch(/40% of the job text matches the original advert/);
  });
});
