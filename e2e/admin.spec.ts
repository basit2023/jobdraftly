import { hashSync } from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { expect, test } from "@playwright/test";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "../src/generated/prisma/client";

const suffix = Date.now().toString(36);
const superEmail = `phase9-super-${suffix}@example.invalid`;
const editorEmail = `phase9-editor-${suffix}@example.invalid`;
const password = "Phase9-QA-Only!2026";
const companyName = `Phase 9 QA Company ${suffix}`;
const jobTitle = `Phase 9 QA Analyst ${suffix}`;

let db: PrismaClient;
let uploadedLogoPath = "";

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL("**/admin/dashboard");
}

test.describe.serial("administrator authentication and CRUD", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for administrator E2E tests.");
    db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
    const passwordHash = hashSync(password, 10);
    await db.admin.createMany({
      data: [
        { email: superEmail, name: "Phase 9 Super Admin", passwordHash, role: "SUPER_ADMIN" },
        { email: editorEmail, name: "Phase 9 Editor", passwordHash, role: "EDITOR" },
      ],
    });
  });

  test.afterAll(async () => {
    const company = await db.company.findFirst({ where: { name: companyName }, select: { id: true } });
    if (company) {
      await db.job.deleteMany({ where: { companyId: company.id } });
      await db.company.deleteMany({ where: { id: company.id } });
    }
    const admins = await db.admin.findMany({ where: { email: { in: [superEmail, editorEmail] } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { adminId: { in: admins.map((admin) => admin.id) } } });
    await db.admin.deleteMany({ where: { id: { in: admins.map((admin) => admin.id) } } });
    if (uploadedLogoPath) await unlink(uploadedLogoPath).catch(() => undefined);
    await db.$disconnect();
  });

  test("invalid credentials are rejected", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email address").fill(superEmail);
    await page.getByLabel("Password").fill("Wrong-Password!123");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();
  });

  test("super administrator can sign in, create and edit core records, and sign out", async ({ page }) => {
    await signIn(page, superEmail);

    const uploadResponse = await page.request.post("/api/admin/uploads/company-logo", {
      multipart: {
        file: {
          name: "phase9-logo.png",
          mimeType: "image/png",
          buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
        },
      },
    });
    expect(uploadResponse.status()).toBe(200);
    const uploadBody = await uploadResponse.json() as { url: string };
    expect(uploadBody.url).toMatch(/^\/uploads\/company-logos\/[0-9a-f-]+\.png$/);
    uploadedLogoPath = path.join(process.cwd(), "public", uploadBody.url.replace(/^\//, ""));

    await page.goto("/admin/companies/new");
    await page.locator('input[name="name"]').fill(companyName);
    await page.locator('input[name="websiteUrl"]').fill("https://example.invalid/phase9-company");
    await page.getByRole("button", { name: "Save company" }).click();
    await page.waitForURL(/\/admin\/companies\?created=1/);
    await expect(page.getByText(companyName)).toBeVisible();

    await page.goto("/admin/jobs/new");
    await page.locator('input[name="title"]').fill(jobTitle);
    await page.locator('select[name="companyId"]').selectOption({ label: companyName });
    await page.locator('select[name="categoryId"]').selectOption({ label: "Government & Public Sector" });
    await page.locator('select[name="locationId"]').selectOption({ label: "Karachi" });
    await page.locator('textarea[name="description"]').fill("Development-only vacancy used to verify administrator creation and editing, then removed automatically.");
    await page.locator('input[name="applicationUrl"]').fill("https://example.invalid/phase9-apply");
    await page.locator('select[name="status"]').selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Save job" }).click();
    await page.waitForURL(/\/admin\/jobs\?created=1/);
    await expect(page.getByText(jobTitle)).toBeVisible();

    const job = await db.job.findFirstOrThrow({ where: { title: jobTitle }, select: { id: true, slug: true } });
    await page.goto(`/jobs/${job.slug}`);
    await expect(page.getByRole("heading", { name: jobTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: /apply now/i })).toHaveAttribute("href", "https://example.invalid/phase9-apply");
    await page.goto(`/jobs?q=${encodeURIComponent(jobTitle)}`);
    await expect(page.getByText(jobTitle).first()).toBeVisible();
    await page.goto("/jobs/government");
    await expect(page.getByText(jobTitle).first()).toBeVisible();

    await page.goto(`/admin/jobs/${job.id}/edit`);
    await page.locator('textarea[name="skills"]').fill("Testing, Quality assurance");
    await page.getByRole("button", { name: "Save job" }).click();
    await page.waitForURL(/\/admin\/jobs\?updated=1/);
    await expect.poll(async () => (await db.job.findUnique({ where: { id: job.id }, select: { skills: true } }))?.skills).toBe("Testing, Quality assurance");

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/admin/login");
    const protectedResponse = await page.goto("/admin/dashboard");
    expect(protectedResponse?.status()).toBe(200);
    await page.waitForURL("**/admin/login");
  });

  test("editor sees source configuration as read-only", async ({ page }) => {
    await signIn(page, editorEmail);
    await page.goto("/admin/sources");
    await expect(page.getByText(/read-only for editors/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save monitoring" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /approve|revoke/i })).toHaveCount(0);
  });
});
