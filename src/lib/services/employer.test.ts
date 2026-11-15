import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { safeDownloadName, validateCvDocument } from "@/lib/security/document-validation";
import { applicationFormSchema, employerJobSchema } from "@/lib/validations/employer";

vi.mock("@/lib/db", () => ({ db: {} }));

const { employerJobStatus, parseEmployerDeadline, EmployerJobError } = await import("./employer-jobs");
const { hashSetupToken } = await import("./employer-accounts");

const pdf = new Uint8Array([...Buffer.from("%PDF-1.7\n"), ...new Uint8Array(200)]);
const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Buffer.from("....word/document.xml"), ...new Uint8Array(100)]);
const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Uint8Array(100)]);

describe("CV validation", () => {
  it("accepts PDF, Word .docx and legacy .doc by their real bytes", () => {
    expect(validateCvDocument(pdf)?.extension).toBe("pdf");
    expect(validateCvDocument(docx)?.extension).toBe("docx");
    expect(validateCvDocument(doc)?.extension).toBe("doc");
  });

  it("rejects other files, including renamed ones and plain ZIPs", () => {
    expect(validateCvDocument(new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // .exe
    expect(validateCvDocument(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(validateCvDocument(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Buffer.from("evil.js"), 0, 0]))).toBeNull();
    expect(validateCvDocument(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBeNull(); // PNG
  });

  it("rejects files over 5 MB", () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(Buffer.from("%PDF-"));
    expect(validateCvDocument(big)).toBeNull();
  });

  it("makes download names safe", () => {
    expect(safeDownloadName('../../Ali "Khan" CV (final).PDF', "pdf")).toBe("Ali-Khan-CV-final.pdf");
    expect(safeDownloadName("....", "docx")).toBe("cv.docx");
  });
});

describe("employer job rules", () => {
  it("publishes immediately only for verified companies", () => {
    expect(employerJobStatus(true)).toBe("PUBLISHED");
    expect(employerJobStatus(false)).toBe("PENDING_REVIEW");
  });

  it("accepts deadlines from today up to 90 days, as the end of that day in Pakistan", () => {
    const now = new Date("2026-11-15T10:00:00+05:00");
    expect(parseEmployerDeadline("2026-11-15", now).toISOString()).toBe("2026-11-15T18:59:59.000Z");
    expect(parseEmployerDeadline("2027-02-13", now)).toBeInstanceOf(Date);
    expect(() => parseEmployerDeadline("2026-11-14", now)).toThrow(EmployerJobError);
    expect(() => parseEmployerDeadline("2027-03-01", now)).toThrow(/90 days/);
  });

  const validJob = {
    title: "Accounts Officer",
    categoryId: "cat",
    locationId: "loc",
    employmentType: "FULL_TIME",
    experienceLevel: "MID_LEVEL",
    workplaceType: "ONSITE",
    description: "We are hiring an accounts officer to manage payables and monthly reconciliations at our Karachi office.",
    salaryVisibility: "RANGE",
    salaryMin: "120000",
    salaryMax: "160000",
    salaryPeriod: "MONTH",
    applicationDeadline: "2026-12-01",
    applicationMethod: "ON_SITE",
  };

  it("validates a complete job", () => {
    expect(employerJobSchema.safeParse(validJob).success).toBe(true);
  });

  it("requires a link for external applications and a sensible salary", () => {
    const external = employerJobSchema.safeParse({ ...validJob, applicationMethod: "EXTERNAL_URL" });
    expect(external.success).toBe(false);
    const javascriptLink = employerJobSchema.safeParse({ ...validJob, applicationMethod: "EXTERNAL_URL", applicationUrl: "javascript:alert(1)" });
    expect(javascriptLink.success).toBe(false);
    const backwards = employerJobSchema.safeParse({ ...validJob, salaryMin: "200000", salaryMax: "100000" });
    expect(backwards.success).toBe(false);
    const noAmount = employerJobSchema.safeParse({ ...validJob, salaryMin: "", salaryMax: "" });
    expect(noAmount.success).toBe(false);
    expect(employerJobSchema.safeParse({ ...validJob, salaryVisibility: "NEGOTIABLE", salaryMin: "", salaryMax: "" }).success).toBe(true);
  });
});

describe("application form", () => {
  const valid = { fullName: "Ayesha Khan", email: "AYESHA@Example.com ", phone: "0300 1234567", city: "", coverLetter: "", consent: "on" };

  it("normalises email and accepts Pakistani phone formats", () => {
    const parsed = applicationFormSchema.parse(valid);
    expect(parsed.email).toBe("ayesha@example.com");
    expect(parsed.city).toBeNull();
    expect(applicationFormSchema.safeParse({ ...valid, phone: "+92 300 1234567" }).success).toBe(true);
  });

  it("requires consent and a real phone number", () => {
    expect(applicationFormSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, phone: "call me" }).success).toBe(false);
  });
});

describe("setup tokens", () => {
  it("stores only a SHA-256 hash, never the token", () => {
    const hash = hashSetupToken("secret-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("secret-token");
  });
});

describe("private CV storage", () => {
  let root = "";
  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "jobdraftly-private-"));
    vi.stubEnv("PRIVATE_STORAGE_DIR", root);
    vi.stubEnv("PRIVATE_STORAGE_S3_BUCKET", "");
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("saves, reads and deletes inside the private folder", async () => {
    const store = await import("@/lib/storage/private-store");
    const key = "cvs/company1/123e4567-e89b-42d3-a456-426614174000.pdf";
    await store.savePrivateFile(key, pdf, "application/pdf");
    expect(Buffer.from(await store.readPrivateFile(key)).equals(Buffer.from(pdf))).toBe(true);
    await store.deletePrivateFile(key);
    expect(await readdir(path.join(root, "cvs", "company1"))).toEqual([]);
  });

  it("refuses keys that could escape the folder", async () => {
    const store = await import("@/lib/storage/private-store");
    for (const key of ["../outside.pdf", "cvs/../../etc/passwd", "/etc/passwd", "cvs/a/evil.exe", "cvs\\..\\..\\x.pdf"]) {
      await expect(store.savePrivateFile(key, pdf, "application/pdf")).rejects.toThrow(/Invalid private storage key/);
    }
  });
});
