import type { Metadata } from "next";
import Link from "next/link";

import { ApplicationStatusBadge, Card, formatDay, JobStatusBadge, Notice, PageTitle, Stat, timeAgo } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { getEmployerDashboard, type DailyPoint } from "@/lib/services/employer-stats";
import { applicationStatuses, applicationStatusLabels } from "@/lib/validations/employer";

export const metadata: Metadata = { title: "Dashboard" };

function TrendChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.views, point.applications)));
  const label = (date: string) => new Date(`${date}T12:00:00+05:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
  return (
    <figure>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Job views and applications per day for the last 14 days">
        {points.map((point) => (
          <div className="group relative flex h-full flex-1 items-end justify-center gap-0.5" key={point.date}>
            <div className="w-1/2 rounded-t-sm bg-ink/15" style={{ height: `${(point.views / max) * 100}%` }} />
            <div className="w-1/2 rounded-t-sm bg-brand" style={{ height: `${(point.applications / max) * 100}%` }} />
            <span className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
              {label(point.date)}: {point.views} views · {point.applications} applied
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{label(points[0].date)}</span>
        <span>{label(points[points.length - 1].date)}</span>
      </div>
      <figcaption className="mt-3 flex gap-4 text-xs text-body">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink/15" /> Job views</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" /> Applications</span>
      </figcaption>
    </figure>
  );
}

export default async function EmployerDashboardPage() {
  const employer = await requireEmployer();
  const data = await getEmployerDashboard(employer.companyId);
  const conversion = data.views30 ? Math.round(((data.applications30 + data.clicks30) / data.views30) * 1000) / 10 : 0;

  return (
    <>
      <PageTitle description="The last 30 days across all your jobs." title={`Welcome, ${employer.name.split(" ")[0]}`} />

      {!employer.company.isVerified ? (
        <div className="mb-6">
          <Notice tone="warning">
            Your company isn&apos;t verified yet, so each job is checked by JobDraftly before it goes live (usually within one working day).
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hint={data.pendingJobs ? `${data.pendingJobs} waiting for approval` : "Visible to job seekers"} label="Live jobs" value={data.liveJobs} />
        <Stat hint="Last 30 days" label="Job views" value={data.views30} />
        <Stat hint={data.clicks30 ? `+ ${data.clicks30} clicks to your apply link` : "Last 30 days"} label="Applications" value={data.applications30} />
        <Stat hint="Applied ÷ viewed" label="Apply rate" value={`${conversion}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Last 14 days">
          <TrendChart points={data.daily} />
        </Card>
        <Card action={<Link className="text-xs font-medium text-brand hover:underline" href="/employer/applications">All applicants</Link>} title="Hiring pipeline">
          {data.totalApplications ? (
            <ul className="space-y-2.5">
              {applicationStatuses.map((status) => {
                const count = data.pipeline[status] ?? 0;
                return (
                  <li key={status}>
                    <Link className="group flex items-center gap-3 text-sm" href={`/employer/applications?status=${status}`}>
                      <span className="w-24 shrink-0 text-body group-hover:text-ink">{applicationStatusLabels[status]}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                        <span className="block h-full rounded-full bg-brand" style={{ width: `${(count / data.totalApplications) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right tabular-nums text-ink">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-body">No applications yet. Jobs set to &ldquo;Apply on JobDraftly&rdquo; collect CVs here.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card action={data.unseen ? <span className="text-xs text-brand">{data.unseen} not opened yet</span> : null} title="Newest applicants">
          {data.recentApplications.length ? (
            <ul className="-my-2 divide-y divide-line">
              {data.recentApplications.map((application) => (
                <li key={application.id}>
                  <Link className="flex items-center justify-between gap-3 py-2.5 hover:text-brand" href={`/employer/applications/${application.id}`}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        {!application.viewedAt ? <span aria-label="Not opened" className="size-2 shrink-0 rounded-full bg-brand" /> : null}
                        <span className="truncate">{application.fullName}</span>
                      </span>
                      <span className="block truncate text-xs text-muted">{application.job.title}{application.city ? ` · ${application.city}` : ""} · {timeAgo(application.createdAt)}</span>
                    </span>
                    <ApplicationStatusBadge status={application.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-body">Applicants will appear here as soon as someone applies.</p>
          )}
        </Card>

        <Card action={<Link className="text-xs font-medium text-brand hover:underline" href="/employer/jobs">All jobs</Link>} title="Open jobs">
          {data.jobs.length ? (
            <ul className="-my-2 divide-y divide-line">
              {data.jobs.map((job) => (
                <li className="flex items-center justify-between gap-3 py-2.5" key={job.id}>
                  <span className="min-w-0">
                    <Link className="block truncate text-sm font-medium text-ink hover:text-brand" href={`/employer/applications?job=${job.id}`}>{job.title}</Link>
                    <span className="block text-xs text-muted">
                      {job.views} views · {job.applicationMethod === "ON_SITE" ? `${job.applications} applied` : `${job.clicks} apply clicks`} · closes {formatDay(job.applicationDeadline)}
                    </span>
                  </span>
                  <JobStatusBadge status={job.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-body">
              <p>You have no open jobs.</p>
              <Link className="mt-3 inline-flex min-h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-brand" href="/employer/jobs/new">Post your first job</Link>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
