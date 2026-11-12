import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { countPublishedJobs } from "@/lib/services/public-jobs";
import { hasSearchParams, pageMetadata, SEO_MIN_INDEXABLE_LISTING_JOBS } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [query, count] = await Promise.all([searchParams, countPublishedJobs({ workplaceType: "REMOTE" })]);
  return pageMetadata({ title: "Remote Jobs in Pakistan", description: "Remote and work-from-home jobs open to candidates in Pakistan. Filter by category, experience and salary, then apply directly with the employer.", path: "/jobs/remote", index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !hasSearchParams(query) });
}

export default async function RemoteJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: "Remote jobs", path: "/jobs/remote" }];
  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      basePath="/jobs/remote"
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description="Jobs you can do from anywhere in Pakistan."
      fixed={{ workplaceType: "REMOTE" }}
      searchParams={await searchParams}
      title="Remote Jobs in Pakistan"
    /></>
  );
}
