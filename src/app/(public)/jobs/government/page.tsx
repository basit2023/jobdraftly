import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { countPublishedJobs } from "@/lib/services/public-jobs";
import { hasSearchParams, pageMetadata, SEO_MIN_INDEXABLE_LISTING_JOBS } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [query, count] = await Promise.all([searchParams, countPublishedJobs({ categorySlug: "government-public-sector" })]);
  return pageMetadata({ title: "Government Jobs in Pakistan", description: "Federal, provincial and public-sector jobs in Pakistan, with links to the official advert.", path: "/jobs/government", index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !hasSearchParams(query) });
}

export default async function GovernmentJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: "Government jobs", path: "/jobs/government" }];
  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      basePath="/jobs/government"
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description="Federal, provincial and public-sector jobs, with links to the official advert."
      fixed={{ categorySlug: "government-public-sector" }}
      searchParams={await searchParams}
      title="Government Jobs in Pakistan"
    /></>
  );
}
