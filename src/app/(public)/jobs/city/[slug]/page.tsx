import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import { countPublishedJobs, getPublicCityBySlug } from "@/lib/services/public-jobs";
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
  const city = await getPublicCityBySlug(slug);
  if (!city) return { title: "City not found", robots: { index: false, follow: false } };
  const [count, query] = await Promise.all([countPublishedJobs({ citySlug: city.slug }), searchParams]);
  const filtered = Object.values(query).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value));

  return pageMetadata({
    title: `Jobs in ${city.name}`,
    description: `Latest jobs in ${city.name}, Pakistan. Find government, private and part-time vacancies in ${city.name} and apply directly with the employer.`,
    path: `/jobs/city/${city.slug}`,
    index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !filtered,
  });
}

export default async function CityJobsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const city = await getPublicCityBySlug(slug);
  if (!city) notFound();

  const region = city.province ? `, ${city.province.name}` : "";
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: city.name, path: `/jobs/city/${city.slug}` }];

  return (
    <><JsonLd data={buildBreadcrumbList(breadcrumbs)} /><JobsIndex
      basePath={`/jobs/city/${city.slug}`}
      breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
      description={`Open jobs in ${city.name}${region}.`}
      fixed={{ citySlug: city.slug }}
      intro={`Current vacancies in ${city.name}${region}. Every listing links to the employer's own application page or the original advert.`}
      searchParams={await searchParams}
      title={`Jobs in ${city.name}`}
    /></>
  );
}
