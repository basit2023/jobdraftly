import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { countPublishedJobs } from "@/lib/services/public-jobs";
import { hasSearchParams, pageMetadata, SEO_MIN_INDEXABLE_LISTING_JOBS } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [query, count] = await Promise.all([searchParams, countPublishedJobs({ employmentType: "INTERNSHIP" })]);
  return pageMetadata({ title: "Internships in Pakistan", description: "Internships for students and recent graduates across Pakistan, by city and field.", path: "/jobs/internships", index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !hasSearchParams(query) });
}

export default async function InternshipJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: "Internships", path: "/jobs/internships" }];
  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      basePath="/jobs/internships"
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description="Internships for students and recent graduates across Pakistan."
      fixed={{ employmentType: "INTERNSHIP" }}
      searchParams={await searchParams}
      title="Internships in Pakistan"
    /></>
  );
}
