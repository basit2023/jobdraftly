import { expect, test } from "@playwright/test";

const publicRoutes = [
  ["/", "Find Your Next Job in Pakistan"],
  ["/jobs", "Jobs in Pakistan"],
  ["/jobs/remote", "Remote Jobs in Pakistan"],
  ["/jobs/government", "Government Jobs in Pakistan"],
  ["/jobs/internships", "Internships in Pakistan"],
  ["/jobs/province/punjab", "Jobs in Punjab"],
  ["/jobs/city/karachi", "Jobs in Karachi"],
  ["/jobs/category/information-technology-software", "Information Technology & Software Jobs"],
  ["/companies", "Companies hiring in Pakistan"],
  ["/about", "A job platform designed for Pakistan"],
  ["/contact", "How can we help?"],
] as const;

test.describe("public website", () => {
  for (const [route, heading] of publicRoutes) {
    test(`${route} renders successfully`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible();
    });
  }

  test("shareable search filters are retained and noindexed", async ({ page }) => {
    await page.goto("/jobs?q=engineer&company=qa&city=karachi&category=engineering&employmentType=FULL_TIME&experienceLevel=MID_LEVEL&workplaceType=ONSITE&salaryMin=50000&salaryMax=200000&sort=newest&page=2");
    await expect(page.locator('input[name="q"]')).toHaveValue("engineer");
    await expect(page.locator('input[name="company"]')).toHaveValue("qa");
    await expect(page.locator('select[name="city"]')).toHaveValue("karachi");
    await expect(page.locator('select[name="category"]')).toHaveValue("engineering");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  });

  test("a missing job detail returns a real 404", async ({ page }) => {
    const response = await page.goto("/jobs/phase9-definitely-missing-vacancy");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /isn't available/i })).toBeVisible();
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
  ]) {
    test(`homepage and jobs page do not overflow at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of ["/", "/jobs"]) {
        await page.goto(route);
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      }
    });
  }

  test("protected API routes reject unauthenticated requests", async ({ request }) => {
    const [monitor, expire, upload, csv] = await Promise.all([
      request.post("/api/cron/monitor-sources"),
      request.post("/api/cron/expire-jobs"),
      request.post("/api/admin/uploads/company-logo"),
      request.post("/api/admin/imports/csv"),
    ]);
    expect(monitor.status()).toBe(401);
    expect(expire.status()).toBe(401);
    expect(upload.status()).toBe(401);
    expect(csv.status()).toBe(401);
  });
});
