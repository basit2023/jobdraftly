import "server-only";

import { db } from "@/lib/db";
import { publishedJobWhere } from "@/lib/services/public-jobs";

import { absoluteUrl, SEO_MIN_INDEXABLE_LISTING_JOBS } from "./site";
import type { SitemapEntry } from "./sitemap-xml";

function validApplicationUrl(value: string | null) {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function latestDate(...values: (Date | null | undefined)[]) {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

export async function jobSitemapEntries(): Promise<SitemapEntry[]> {
  const jobs = await db.job.findMany({
    where: publishedJobWhere(),
    orderBy: { updatedAt: "desc" },
    select: { slug: true, updatedAt: true, applicationUrl: true },
    take: 50_000,
  });
  return jobs
    .filter((job) => validApplicationUrl(job.applicationUrl))
    .map((job) => ({
      url: absoluteUrl(`/jobs/${job.slug}`),
      lastModified: job.updatedAt,
    }));
}

export async function categorySitemapEntries(): Promise<SitemapEntry[]> {
  const publicWhere = publishedJobWhere();
  const categories = await db.jobCategory.findMany({
    where: { isActive: true, jobs: { some: publicWhere } },
    select: {
      slug: true,
      updatedAt: true,
      _count: { select: { jobs: { where: publicWhere } } },
      jobs: {
        where: publicWhere,
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });
  return categories
    .filter(
      (category) =>
        category.slug !== "government-public-sector" &&
        category._count.jobs >= SEO_MIN_INDEXABLE_LISTING_JOBS,
    )
    .map((category) => ({
      url: absoluteUrl(`/jobs/category/${category.slug}`),
      lastModified: latestDate(category.updatedAt, category.jobs[0]?.updatedAt),
    }));
}

export async function locationSitemapEntries(): Promise<SitemapEntry[]> {
  const publicWhere = publishedJobWhere();
  const [cities, provinces] = await Promise.all([
    db.jobLocation.findMany({
      where: { isActive: true, type: "CITY", jobs: { some: publicWhere } },
      select: {
        slug: true,
        updatedAt: true,
        _count: { select: { jobs: { where: publicWhere } } },
        jobs: {
          where: publicWhere,
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    }),
    db.jobLocation.findMany({
      where: { isActive: true, type: "PROVINCE" },
      select: {
        slug: true,
        updatedAt: true,
        jobs: {
          where: publicWhere,
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        },
        cities: {
          where: { isActive: true },
          select: {
            updatedAt: true,
            jobs: {
              where: publicWhere,
              orderBy: { updatedAt: "desc" },
              select: { updatedAt: true },
            },
          },
        },
      },
    }),
  ]);

  const cityEntries = cities
    .filter((city) => city._count.jobs >= SEO_MIN_INDEXABLE_LISTING_JOBS)
    .map((city) => ({
      url: absoluteUrl(`/jobs/city/${city.slug}`),
      lastModified: latestDate(city.updatedAt, city.jobs[0]?.updatedAt),
    }));
  const provinceEntries = provinces
    .map((province) => {
      const jobs = [...province.jobs, ...province.cities.flatMap((city) => city.jobs)];
      return {
        count: jobs.length,
        entry: {
          url: absoluteUrl(`/jobs/province/${province.slug}`),
          lastModified: latestDate(
            province.updatedAt,
            ...province.cities.map((city) => city.updatedAt),
            ...jobs.map((job) => job.updatedAt),
          ),
        },
      };
    })
    .filter((province) => province.count >= SEO_MIN_INDEXABLE_LISTING_JOBS)
    .map((province) => province.entry);

  return [...provinceEntries, ...cityEntries];
}

export async function citySitemapEntries(): Promise<SitemapEntry[]> {
  return (await locationSitemapEntries()).filter((entry) =>
    entry.url.includes("/jobs/city/"),
  );
}

export async function organizationSitemapEntries(): Promise<SitemapEntry[]> {
  const publicWhere = publishedJobWhere();
  const companies = await db.company.findMany({
    where: {
      isActive: true,
      isVerified: true,
      jobs: { some: publicWhere },
    },
    select: {
      slug: true,
      updatedAt: true,
      jobs: {
        where: publicWhere,
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
    take: 20_000,
  });
  return companies.map((company) => ({
    url: absoluteUrl(`/companies/${company.slug}`),
    lastModified: latestDate(company.updatedAt, company.jobs[0]?.updatedAt),
  }));
}

// The current product has no Announcement entity or public announcement route.
// Keep this feed empty until real, canonical announcement records are introduced.
export async function announcementSitemapEntries(): Promise<SitemapEntry[]> {
  return [];
}

export async function pageSitemapEntries(): Promise<SitemapEntry[]> {
  const publicWhere = publishedJobWhere();
  const [remoteJobs, governmentJobs, internships] = await Promise.all([
    db.job.count({
      where: { AND: [publicWhere, { workplaceType: "REMOTE" }] },
    }),
    db.job.count({
      where: {
        AND: [
          publicWhere,
          { category: { slug: "government-public-sector" } },
        ],
      },
    }),
    db.job.count({
      where: { AND: [publicWhere, { employmentType: "INTERNSHIP" }] },
    }),
  ]);
  const staticPaths = [
    "/",
    "/jobs",
    "/companies",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
  ];
  const discoveryPaths = [
    ...(remoteJobs >= SEO_MIN_INDEXABLE_LISTING_JOBS ? ["/jobs/remote"] : []),
    ...(governmentJobs >= SEO_MIN_INDEXABLE_LISTING_JOBS
      ? ["/jobs/government"]
      : []),
    ...(internships >= SEO_MIN_INDEXABLE_LISTING_JOBS
      ? ["/jobs/internships"]
      : []),
  ];
  return staticPaths
    .concat(discoveryPaths)
    .map((path) => ({ url: absoluteUrl(path) }));
}
