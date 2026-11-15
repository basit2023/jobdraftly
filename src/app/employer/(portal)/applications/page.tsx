import type { Metadata } from "next";
import Link from "next/link";

import { ApplicationStatusBadge, formatDay, inputClass, PageTitle } from "@/components/employer/ui";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { applicationStatuses, applicationStatusLabels } from "@/lib/validations/employer";

export const metadata: Metadata = { title: "Applicants" };

const PAGE_SIZE = 25;

type Search = { status?: string; job?: string; q?: string; page?: string };

function href(current: Search, change: Partial<Search>) {
  const params = new URLSearchParams();
  const next = { ...current, ...change };
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/employer/applications?${query}` : "/employer/applications";
}

export default async function EmployerApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const employer = await requireEmployer();
  const raw = await searchParams;
  const status = (applicationStatuses as readonly string[]).includes(raw.status ?? "") ? (raw.status as ApplicationStatus) : undefined;
  const q = (raw.q ?? "").trim().slice(0, 100);

  const jobs = await db.job.findMany({
    where: { companyId: employer.companyId, applicationMethod: "ON_SITE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true },
  });
  const jobId = jobs.some((job) => job.id === raw.job) ? raw.job : undefined;

  const base: Prisma.JobApplicationWhereInput = {
    companyId: employer.companyId,
    ...(jobId ? { jobId } : {}),
    ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { city: { contains: q } }] } : {}),
  };
  const where: Prisma.JobApplicationWhereInput = { ...base, ...(status ? { status } : {}) };
  const requestedPage = Math.max(1, Number(raw.page) || 1);

  const [byStatus, total] = await Promise.all([
    db.jobApplication.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.jobApplication.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const applications = await db.jobApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, fullName: true, email: true, phone: true, city: true, status: true, viewedAt: true, createdAt: true, job: { select: { title: true } } },
  });
  const allCount = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  const current: Search = { status: status ?? "", job: jobId ?? "", q };

  return (
    <>
      <PageTitle description="Everyone who applied through JobDraftly. Open an applicant to read their CV, move them along, or keep notes." title="Applicants" />

      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_260px_auto]" method="get">
        {status ? <input name="status" type="hidden" value={status} /> : null}
        <input aria-label="Search applicants" className={inputClass} defaultValue={q} name="q" placeholder="Search name, email, phone or city" type="search" />
        <select aria-label="Job" className={inputClass} defaultValue={jobId ?? ""} name="job">
          <option value="">All jobs</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}{job.status !== "PUBLISHED" ? " (not live)" : ""}</option>)}
        </select>
        <button className="min-h-11 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-brand" type="submit">Filter</button>
      </form>

      <nav aria-label="Stage" className="mb-4 flex flex-wrap gap-2">
        <Link aria-current={!status ? "page" : undefined} className={`rounded-full border px-3.5 py-1.5 text-sm ${!status ? "border-ink bg-ink text-white" : "border-line bg-white text-body hover:border-ink/30"}`} href={href(current, { status: "", page: "" })}>
          All <span className="tabular-nums opacity-70">{allCount}</span>
        </Link>
        {applicationStatuses.map((item) => {
          const count = byStatus.find((row) => row.status === item)?._count._all ?? 0;
          return (
            <Link aria-current={status === item ? "page" : undefined} className={`rounded-full border px-3.5 py-1.5 text-sm ${status === item ? "border-ink bg-ink text-white" : "border-line bg-white text-body hover:border-ink/30"}`} href={href(current, { status: item, page: "" })} key={item}>
              {applicationStatusLabels[item]} <span className="tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <ul className="divide-y divide-line">
          {applications.map((application) => (
            <li key={application.id}>
              <Link className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-paper" href={`/employer/applications/${application.id}`}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    {!application.viewedAt ? <span aria-label="Not opened" className="size-2 shrink-0 rounded-full bg-brand" /> : null}
                    {application.fullName}
                  </span>
                  <span className="block truncate text-xs text-muted">{application.job.title} · {application.city ?? "City not given"} · {application.phone}</span>
                </span>
                <span className="text-xs text-muted">{formatDay(application.createdAt)}</span>
                <ApplicationStatusBadge status={application.status} />
              </Link>
            </li>
          ))}
        </ul>
        {!applications.length ? (
          <p className="px-6 py-12 text-center text-sm text-body">
            {allCount ? "No applicants match these filters." : "No applications yet. Set a job to “Apply on JobDraftly” to collect CVs here."}
          </p>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? <Link className="rounded-md border border-line bg-white px-3 py-1.5" href={href(current, { page: String(page - 1) })}>Previous</Link> : null}
          <span className="px-2 text-muted">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link className="rounded-md border border-line bg-white px-3 py-1.5" href={href(current, { page: String(page + 1) })}>Next</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
