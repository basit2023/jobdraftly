import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// The real server action runs; only the Next.js request plumbing is replaced.
vi.mock("@/lib/auth/session", () => ({ requireAdmin: async () => ({ id: "test-admin", role: "SUPER_ADMIN", name: "Test", email: "t@example.com" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
// Audit rows need a real admin id; they're not what this test is about.
vi.mock("@/lib/services/admin-audit", () => ({ createAuditLog: async () => undefined }));

const runDatabaseTests = Boolean(process.env.DATABASE_URL);

describe.runIf(runDatabaseTests)("admin 'Add company' with an owner login", async () => {
  const { db } = await import("@/lib/db");
  const { createCompanyAction } = await import("./actions");
  const suffix = randomUUID().slice(0, 8);
  const createdNames: string[] = [];

  function form(fields: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ isActive: "on", ...fields })) data.set(key, value);
    return data;
  }

  async function submit(fields: Record<string, string>) {
    if (fields.name) createdNames.push(fields.name);
    try {
      return { state: await createCompanyAction({ success: false, message: "" }, form(fields)), redirectedTo: null as string | null };
    } catch (error) {
      const url = (error as { url?: string }).url;
      if (!url) throw error;
      return { state: null, redirectedTo: url };
    }
  }

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SMTP_HOST", ""); // development: emails go to storage/dev-outbox
    vi.stubEnv("NODE_ENV", "development");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    const companies = await db.company.findMany({ where: { name: { in: createdNames } }, select: { id: true } });
    await db.employerUser.deleteMany({ where: { companyId: { in: companies.map((c) => c.id) } } });
    await db.company.deleteMany({ where: { id: { in: companies.map((c) => c.id) } } });
    await db.$disconnect();
  });

  it("creates the company and the owner's login, sends the email, and opens the company page", async () => {
    const email = `owner-${suffix}@example.com`;
    const { redirectedTo } = await submit({ name: `Create Test ${suffix}`, ownerName: "Sara Ahmed", ownerEmail: ` ${email.toUpperCase()} ` });

    const company = await db.company.findFirstOrThrow({ where: { name: `Create Test ${suffix}` }, include: { employerUsers: true } });
    expect(redirectedTo).toBe(`/admin/companies/${company.id}/edit?login=saved`);
    expect(company.employerUsers).toHaveLength(1);
    expect(company.employerUsers[0]).toMatchObject({ email, name: "Sara Ahmed", role: "OWNER", isActive: true, passwordHash: null });
    expect(company.employerUsers[0].setupTokenHash).toMatch(/^[0-9a-f]{64}$/);

    // The verification email was written to the dev outbox for this address.
    const outbox = path.join(process.cwd(), "storage", "dev-outbox");
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(outbox)).sort().reverse();
    const latest = await readFile(path.join(outbox, files[0]), "utf8");
    expect(latest).toContain(`To: ${email}`);
    expect(latest).toContain("/employer/setup?token=");
    await rm(path.join(outbox, files[0]));
  });

  it("creates only the company when the login fields are left empty", async () => {
    const { redirectedTo } = await submit({ name: `No Login ${suffix}`, ownerName: "", ownerEmail: "" });
    expect(redirectedTo).toBe("/admin/companies?created=1");
    const company = await db.company.findFirstOrThrow({ where: { name: `No Login ${suffix}` }, include: { employerUsers: true } });
    expect(company.employerUsers).toHaveLength(0);
  });

  it("rejects half-filled or duplicate login details without creating anything", async () => {
    const half = await submit({ name: `Half ${suffix}`, ownerName: "", ownerEmail: `half-${suffix}@example.com` });
    expect(half.state?.errors?.ownerName?.[0]).toBe("Enter the person's name");
    const bad = await submit({ name: `Bad Email ${suffix}`, ownerName: "Ali", ownerEmail: "not-an-email" });
    expect(bad.state?.errors?.ownerEmail?.[0]).toBe("Enter a valid email address");
    const dup = await submit({ name: `Dup ${suffix}`, ownerName: "Ali", ownerEmail: `owner-${suffix}@example.com` });
    expect(dup.state?.errors?.ownerEmail?.[0]).toMatch(/already has a company login/);

    expect(await db.company.count({ where: { name: { in: [`Half ${suffix}`, `Bad Email ${suffix}`, `Dup ${suffix}`] } } })).toBe(0);
  });
});
