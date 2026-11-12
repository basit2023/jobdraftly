import { cache } from "react";

import type {
  EmploymentType,
  Prisma,
  WorkplaceType,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { JobSearchFilters } from "@/lib/validations/job-search";

const jobCardSelect = {
  id: true,
  title: true,
  slug: true,
  employmentType: true,
  workplaceType: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryVisibility: true,
  salaryPeriod: true,
  isFeatured: true,
  publishedAt: true,
  company: { select: { id: true, name: true, slug: true, logoUrl: true } },
  category: { select: { id: true, name: true, slug: true } },
  location: { select: { id: true, name: true, slug: true, province: { select: { name: true, slug: true } } } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.JobSelect;

const jobDetailInclude = {
  company: true,
  category: true,
  location: { include: { province: true } },
  tags: { include: { tag: true } },
  source: true,
} satisfies Prisma.JobInclude;

export type PublicJobCard = Prisma.JobGetPayload<{
  select: typeof jobCardSelect;
}>;

export type PublicJobDetail = Prisma.JobGetPayload<{
  include: typeof jobDetailInclude;
}>;

export type FixedJobFilters = {
  categorySlug?: string;
  citySlug?: string;
  provinceSlug?: string;
  employmentType?: EmploymentType;
  workplaceType?: WorkplaceType;
};

export function publishedJobWhere(now = new Date()): Prisma.JobWhereInput {
  const pakistanDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const pakistanDayStart = new Date(`${pakistanDate}T00:00:00+05:00`);
  return {
    status: "PUBLISHED",
    publishedAt: { lte: now },
    company: { isActive: true },
    category: { isActive: true },
    location: { isActive: true },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: pakistanDayStart } }] },
      {
        OR: [
          { jobImportId: null },
          {
            verificationStatus: "VERIFIED",
            source: { is: { isActive: true, permissionStatus: "APPROVED" } },
          },
        ],
      },
    ],
  };
}

function sanitizedRelevanceTerm(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function searchPublishedJobs(
  filters: JobSearchFilters,
  fixed: FixedJobFilters = {},
) {
  const now = new Date();
  const conditions: Prisma.JobWhereInput[] = [publishedJobWhere(now)];

  if (filters.q) {
    conditions.push({
      OR: [
        { title: { contains: filters.q } },
        { description: { contains: filters.q } },
        { skills: { contains: filters.q } },
        { company: { name: { contains: filters.q } } },
      ],
    });
  }

  if (filters.company) {
    conditions.push({ company: { name: { contains: filters.company } } });
  }

  const categorySlug = fixed.categorySlug ?? filters.category;
  const citySlug = fixed.citySlug ?? filters.city;
  const employmentType = fixed.employmentType ?? filters.employmentType;
  const workplaceType = fixed.workplaceType ?? filters.workplaceType;

  if (categorySlug) conditions.push({ category: { slug: categorySlug } });
  if (citySlug) conditions.push({ location: { slug: citySlug } });
  if (fixed.provinceSlug) {
    conditions.push({
      location: {
        OR: [
          { slug: fixed.provinceSlug, type: "PROVINCE" },
          { province: { is: { slug: fixed.provinceSlug } } },
        ],
      },
    });
  }
  if (employmentType) {
    conditions.push({ employmentType });
  }
  if (filters.experienceLevel) {
    conditions.push({ experienceLevel: filters.experienceLevel });
  }
  if (workplaceType) {
    conditions.push({ workplaceType });
  }

  if (filters.salaryMin !== undefined) {
    conditions.push({
      salaryVisibility: { not: "HIDDEN" },
      OR: [
        { salaryMax: { gte: filters.salaryMin } },
        { salaryMin: { gte: filters.salaryMin } },
      ],
    });
  }

  if (filters.salaryMax !== undefined) {
    conditions.push({
      salaryVisibility: { not: "HIDDEN" },
      OR: [
        { salaryMin: { lte: filters.salaryMax } },
        { salaryMax: { lte: filters.salaryMax } },
      ],
    });
  }

  const where: Prisma.JobWhereInput = { AND: conditions };
  const relevanceTerm = sanitizedRelevanceTerm(filters.q);
  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    filters.sort === "relevance" && relevanceTerm
      ? [
          {
            _relevance: {
              fields: ["title", "description", "skills"],
              search: relevanceTerm,
              sort: "desc",
            },
          },
          { publishedAt: "desc" },
        ]
      : [{ publishedAt: "desc" }, { createdAt: "desc" }];

  const pageSize = 12;
  const requestedPage = filters.page;
  const [total, requestedJobs] = await Promise.all([
    db.job.count({ where }),
    db.job.findMany({
      where,
      select: jobCardSelect,
      orderBy,
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const jobs = page === requestedPage ? requestedJobs : await db.job.findMany({ where, select: jobCardSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize });

  return {
    jobs,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getSearchOptions() {
  const [categories, cities] = await Promise.all([
    db.jobCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
    }),
    db.jobLocation.findMany({
      where: { isActive: true, type: "CITY" },
      orderBy: [{ name: "asc" }],
      select: { name: true, slug: true },
    }),
  ]);

  return { categories, cities };
}

export async function getHomepageData() {
  const now = new Date();
  const publicWhere = publishedJobWhere(now);

  const [categories, cities, latestJobs, featuredJobs, featuredCompanies] =
    await Promise.all([
      db.jobCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 12,
        include: { _count: { select: { jobs: { where: publicWhere } } } },
      }),
      db.jobLocation.findMany({
        where: { isActive: true, type: "CITY" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 24,
        include: { _count: { select: { jobs: { where: publicWhere } } } },
      }),
      db.job.findMany({
        where: publicWhere,
        select: jobCardSelect,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 6,
      }),
      db.job.findMany({
        where: { AND: [publicWhere, { isFeatured: true }] },
        select: jobCardSelect,
        orderBy: [{ publishedAt: "desc" }],
        take: 4,
      }),
      db.company.findMany({
        where: {
          isActive: true,
          isVerified: true,
          jobs: { some: publicWhere },
        },
        orderBy: [{ name: "asc" }],
        take: 8,
        include: { _count: { select: { jobs: { where: publicWhere } } } },
      }),
    ]);

  return {
    categories: [...categories].sort(
      (a, b) => b._count.jobs - a._count.jobs || a.sortOrder - b.sortOrder,
    ).slice(0, 8),
    cities: [...cities].sort(
      (a, b) => b._count.jobs - a._count.jobs || a.name.localeCompare(b.name),
    ).slice(0, 12),
    latestJobs,
    featuredJobs,
    featuredCompanies,
  };
}

export const getPublishedJobBySlug = cache(async (slug: string) => {
  return db.job.findFirst({
    where: { AND: [publishedJobWhere(), { slug }] },
    include: jobDetailInclude,
  });
});

export const getPublishedJobRedirect = cache(async (oldSlug: string) => {
  return db.jobSlugRedirect.findFirst({
    where: { oldSlug, job: publishedJobWhere() },
    select: { job: { select: { slug: true } } },
  });
});

export const countPublishedJobs = cache(async (fixed: FixedJobFilters = {}) => {
  return db.job.count({
    where: {
      AND: [
        publishedJobWhere(),
        ...(fixed.categorySlug ? [{ category: { slug: fixed.categorySlug } }] : []),
        ...(fixed.citySlug ? [{ location: { slug: fixed.citySlug } }] : []),
        ...(fixed.provinceSlug
          ? [{
              location: {
                OR: [
                  { slug: fixed.provinceSlug, type: "PROVINCE" as const },
                  { province: { is: { slug: fixed.provinceSlug } } },
                ],
              },
            }]
          : []),
        ...(fixed.employmentType ? [{ employmentType: fixed.employmentType }] : []),
        ...(fixed.workplaceType ? [{ workplaceType: fixed.workplaceType }] : []),
      ],
    },
  });
});

export const getPublicCategoryBySlug = cache(async (slug: string) => {
  return db.jobCategory.findFirst({ where: { slug, isActive: true } });
});

export const getPublicCityBySlug = cache(async (slug: string) => {
  return db.jobLocation.findFirst({
    where: { slug, isActive: true, type: "CITY" },
    include: { province: true },
  });
});

export const getPublicProvinceBySlug = cache(async (slug: string) => {
  return db.jobLocation.findFirst({
    where: { slug, isActive: true, type: "PROVINCE" },
  });
});

export const getRelatedPublishedJobs = cache(async (jobId: string, categoryId: string, locationId: string) => {
  return db.job.findMany({
    where: {
      AND: [
        publishedJobWhere(),
        { id: { not: jobId } },
        { OR: [{ categoryId }, { locationId }] },
      ],
    },
    select: jobCardSelect,
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 3,
  });
});

export async function getPublicCompanies(query = "") {
  const publicWhere = publishedJobWhere();
  return db.company.findMany({
    where: {
      isActive: true,
      isVerified: true,
      ...(query ? { name: { contains: query.slice(0, 120) } } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { jobs: { where: publicWhere } } } },
  });
}

export const getPublicCompanyBySlug = cache(async (slug: string) => {
  const publicWhere = publishedJobWhere();
  return db.company.findFirst({
    where: { slug, isActive: true, isVerified: true },
    include: {
      jobs: {
        where: publicWhere,
        select: jobCardSelect,
        orderBy: { publishedAt: "desc" },
        take: 12,
      },
    },
  });
});
