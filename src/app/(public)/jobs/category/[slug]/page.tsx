import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { countPublishedJobs, getPublicCategoryBySlug } from "@/lib/services/public-jobs";
import { pageMetadata, SEO_MIN_INDEXABLE_LISTING_JOBS } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  if (!category) return { title: "Job category not found", robots: { index: false, follow: false } };
  const [count, query] = await Promise.all([countPublishedJobs({ categorySlug: category.slug }), searchParams]);
  const filtered = Object.values(query).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));

  return pageMetadata({
    title: `${category.name} Jobs in Pakistan`,
    description: `Latest ${category.name.toLocaleLowerCase("en")} jobs in Pakistan. Browse current vacancies by city, experience and salary, and apply directly with the employer.`,
    path: category.slug === "government-public-sector" ? "/jobs/government" : `/jobs/category/${category.slug}`,
    index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !filtered,
  });
}

export default async function CategoryJobsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);
  if (!category) notFound();
  if (category.slug === "government-public-sector") permanentRedirect("/jobs/government");
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: category.name, path: `/jobs/category/${category.slug}` }];

  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      basePath={`/jobs/category/${category.slug}`}
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description={`Open ${category.name.toLocaleLowerCase("en")} jobs across Pakistan.`}
      fixed={{ categorySlug: category.slug }}
      intro={category.description ?? `Current ${category.name.toLocaleLowerCase("en")} vacancies from employers across Pakistan. Narrow the list by city, experience level, job type or salary, and apply directly on the employer's site.`}
      searchParams={await searchParams}
      title={`${category.name} Jobs`}
    /></>
  );
}
