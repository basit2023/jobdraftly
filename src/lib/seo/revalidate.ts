import { revalidatePath } from "next/cache";

const PUBLIC_JOB_DISCOVERY_PATHS = [
  "/",
  "/jobs",
  "/sitemap.xml",
  "/sitemaps/pages.xml",
  "/sitemaps/jobs.xml",
  "/sitemaps/categories.xml",
  "/sitemaps/locations.xml",
  "/sitemaps/organizations.xml",
] as const;

/** Refresh public listings and every sitemap whose contents can change with a job. */
export function revalidatePublicJobDiscovery() {
  for (const path of PUBLIC_JOB_DISCOVERY_PATHS) revalidatePath(path);
}
