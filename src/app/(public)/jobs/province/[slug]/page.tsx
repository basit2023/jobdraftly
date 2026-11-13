import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobsIndex } from "@/components/jobs/jobs-index";
import { JsonLd } from "@/components/seo/json-ld";
import {
  countPublishedJobs,
  getPublicProvinceBySlug,
} from "@/lib/services/public-jobs";
import { pageMetadata, SEO_MIN_INDEXABLE_LISTING_JOBS } from "@/lib/seo/site";
import { buildBreadcrumbList } from "@/lib/seo/structured-data";
import type { RawSearchParams } from "@/lib/validations/job-search";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

function hasFilters(query: RawSearchParams) {
  return Object.values(query).some((value) =>
    Array.isArray(value) ? value.some(Boolean) : Boolean(value),
  );
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const province = await getPublicProvinceBySlug(slug);
  // Resolve 404s here: metadata runs before streaming, so the response gets a real 404 status.
  if (!province) notFound();
  const [count, query] = await Promise.all([
    countPublishedJobs({ provinceSlug: province.slug }),
    searchParams,
  ]);

  return pageMetadata({
    title: `Jobs in ${province.name}`,
    description: `Latest jobs across ${province.name}, Pakistan, including government and private vacancies in its cities. Filter by category and salary and apply directly.`,
    path: `/jobs/province/${province.slug}`,
    index: count >= SEO_MIN_INDEXABLE_LISTING_JOBS && !hasFilters(query),
  });
}

export default async function ProvinceJobsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const province = await getPublicProvinceBySlug(slug);
  if (!province) notFound();

  const path = `/jobs/province/${province.slug}`;
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Jobs", path: "/jobs" },
    { name: province.name, path },
  ];

  return (
    <>
      <JsonLd data={buildBreadcrumbList(breadcrumbs)} />
      <JobsIndex
        basePath={path}
        breadcrumbs={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))}
        description={`Open jobs across ${province.name}.`}
        fixed={{ provinceSlug: province.slug }}
        intro={`Current vacancies from cities across ${province.name}, plus roles open anywhere in the province. Every listing links to the employer's own application page or the original advert.`}
        searchParams={await searchParams}
        title={`Jobs in ${province.name}`}
      />
    </>
  );
}
