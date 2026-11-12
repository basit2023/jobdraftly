import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, hasSearchParams } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = await searchParams;
  return pageMetadata({ title: "Jobs in Pakistan", description: "Search the latest jobs in Pakistan by title, company, city, category, experience and salary. Every listing links directly to the employer's application.", path: "/jobs", index: !hasSearchParams(query) });
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }];
  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description="Search open jobs across Pakistan by title, city, company and salary."
      searchParams={await searchParams}
      title="Jobs in Pakistan"
    /></>
  );
}
