import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const DAY = 86_400_000;

/** Pakistan calendar date (YYYY-MM-DD) for a timestamp. */
function pakistanDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export type DailyPoint = { date: string; views: number; applications: number };

/** Counts per job for a company: views, external apply clicks and on-site applications. */
export async function getJobPerformance(companyId: string, jobIds: string[], since: Date = new Date(Date.now() - 30 * DAY)) {
  if (!jobIds.length) return new Map<string, { views: number; clicks: number; applications: number; newApplications: number }>();
  const [views, clicks, applications, unseen] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["jobId"], where: { type: "JOB_VIEW", jobId: { in: jobIds }, occurredAt: { gte: since } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["jobId"], where: { type: "APPLICATION_LINK_CLICK", jobId: { in: jobIds }, occurredAt: { gte: since } }, _count: { _all: true } }),
    db.jobApplication.groupBy({ by: ["jobId"], where: { companyId, jobId: { in: jobIds } }, _count: { _all: true } }),
    db.jobApplication.groupBy({ by: ["jobId"], where: { companyId, jobId: { in: jobIds }, viewedAt: null }, _count: { _all: true } }),
  ]);
  const count = (rows: { jobId: string | null; _count: { _all: number } }[], id: string) => rows.find((row) => row.jobId === id)?._count._all ?? 0;
  return new Map(jobIds.map((id) => [id, { views: count(views, id), clicks: count(clicks, id), applications: count(applications, id), newApplications: count(unseen, id) }]));
}

export async function getEmployerDashboard(companyId: string, now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since14 = new Date(now.getTime() - 13 * DAY);
  const [jobsByStatus, views30, clicks30, applicationsByStatus, applications30, unseen, recentApplications, jobs] = await Promise.all([
    db.job.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.analyticsEvent.count({ where: { type: "JOB_VIEW", occurredAt: { gte: since30 }, job: { companyId } } }),
    db.analyticsEvent.count({ where: { type: "APPLICATION_LINK_CLICK", occurredAt: { gte: since30 }, job: { companyId } } }),
    db.jobApplication.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.jobApplication.count({ where: { companyId, createdAt: { gte: since30 } } }),
    db.jobApplication.count({ where: { companyId, viewedAt: null } }),
    db.jobApplication.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, fullName: true, city: true, status: true, viewedAt: true, createdAt: true, job: { select: { title: true } } },
    }),
    db.job.findMany({
      where: { companyId, status: { in: ["PUBLISHED", "PENDING_REVIEW"] } },
      orderBy: [{ status: "asc" }, { applicationDeadline: "asc" }],
      take: 8,
      select: { id: true, title: true, status: true, applicationDeadline: true, applicationMethod: true, location: { select: { name: true } } },
    }),
  ]);

  // Daily trend for the last 14 days, grouped on Pakistan dates in the database.
  const [viewRows, applicationRows] = await Promise.all([
    db.$queryRaw<{ day: Date | string; n: bigint | number }[]>(Prisma.sql`
      SELECT DATE(e.occurredAt + INTERVAL 5 HOUR) AS day, COUNT(*) AS n
      FROM analytics_events e JOIN jobs j ON j.id = e.jobId
      WHERE j.companyId = ${companyId} AND e.type = 'JOB_VIEW' AND e.occurredAt >= ${since14}
      GROUP BY day`),
    db.$queryRaw<{ day: Date | string; n: bigint | number }[]>(Prisma.sql`
      SELECT DATE(a.createdAt + INTERVAL 5 HOUR) AS day, COUNT(*) AS n
      FROM job_applications a
      WHERE a.companyId = ${companyId} AND a.createdAt >= ${since14}
      GROUP BY day`),
  ]);
  const key = (value: Date | string) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
  const viewsByDay = new Map(viewRows.map((row) => [key(row.day), Number(row.n)]));
  const applicationsByDay = new Map(applicationRows.map((row) => [key(row.day), Number(row.n)]));
  const daily: DailyPoint[] = Array.from({ length: 14 }, (_, index) => {
    const date = pakistanDate(new Date(since14.getTime() + index * DAY));
    return { date, views: viewsByDay.get(date) ?? 0, applications: applicationsByDay.get(date) ?? 0 };
  });

  const performance = await getJobPerformance(companyId, jobs.map((job) => job.id), since30);
  const statusCount = (rows: { status: string; _count: { _all: number } }[], status: string) => rows.find((row) => row.status === status)?._count._all ?? 0;

  return {
    liveJobs: statusCount(jobsByStatus, "PUBLISHED"),
    pendingJobs: statusCount(jobsByStatus, "PENDING_REVIEW"),
    closedJobs: statusCount(jobsByStatus, "CLOSED") + statusCount(jobsByStatus, "EXPIRED"),
    views30,
    clicks30,
    applications30,
    unseen,
    pipeline: Object.fromEntries(applicationsByStatus.map((row) => [row.status, row._count._all])) as Record<string, number>,
    totalApplications: applicationsByStatus.reduce((sum, row) => sum + row._count._all, 0),
    recentApplications,
    jobs: jobs.map((job) => ({ ...job, ...(performance.get(job.id) ?? { views: 0, clicks: 0, applications: 0, newApplications: 0 }) })),
    daily,
  };
}
