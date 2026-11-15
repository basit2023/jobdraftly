import type { Metadata } from "next";
import Link from "next/link";

import { closeEmployerJobAction } from "@/app/employer/actions";
import { ConfirmSubmit } from "@/components/employer/form-bits";
import { formatDay, JobStatusBadge, Notice, PageTitle } from "@/components/employer/ui";
import type { Prisma } from "@/generated/prisma/client";
import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { getJobPerformance } from "@/lib/services/employer-stats";

export const metadata: Metadata = { title: "Jobs" };

const tabs = [
  { key: "open", label: "Open", where: { status: "PUBLISHED" } },
  { key: "review", label: "Waiting for approval", where: { status: "PENDING_REVIEW" } },
  { key: "closed", label: "Closed & expired", where: { status: { in: ["CLOSED", "EXPIRED", "REJECTED"] } } },
  { key: "all", label: "All", where: {} },
] as const satisfies readonly { key: string; label: string; where: Prisma.JobWhereInput }[];

export default async function EmployerJobsPage({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const employer = await requireEmployer();
  const { tab: rawTab, saved } = await searchParams;
  const tab = tabs.find((item) => item.key === rawTab) ?? tabs[0];

  const [counts, jobs] = await Promise.all([
    Promise.all(tabs.map((item) => db.job.count({ where: { companyId: employer.companyId, ...item.where } }))),
    db.job.findMany({
      where: { companyId: employer.companyId, ...tab.where },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      select: {
        id: true, title: true, slug: true, status: true, applicationDeadline: true, applicationMethod: true, createdAt: true,
        location: { select: { name: true } },
        postedByEmployer: { select: { name: true } },
      },
    }),
  ]);
  const performance = await getJobPerformance(employer.companyId, jobs.map((job) => job.id));

  return (
    <>
      <PageTitle
        action={<Link className="inline-flex min-h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-brand" href="/employer/jobs/new">Post a job</Link>}
        description="Edit a job to change it, or to reopen one that has closed. Views count the last 30 days."
        title="Jobs"
      />

      {saved === "live" ? <div className="mb-5"><Notice tone="success">Saved. Your job is live on JobDraftly.</Notice></div> : null}
      {saved === "review" ? <div className="mb-5"><Notice tone="success">Saved. JobDraftly will check the job and publish it, usually within one working day.</Notice></div> : null}

      <nav aria-label="Job status" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item, index) => (
          <Link
            aria-current={item.key === tab.key ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${item.key === tab.key ? "border-ink bg-ink text-white" : "border-line bg-white text-body hover:border-ink/30"}`}
            href={`/employer/jobs?tab=${item.key}`}
            key={item.key}
          >
            {item.label} <span className="tabular-nums opacity-70">{counts[index]}</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Views</th>
                <th className="px-4 py-3 text-right font-medium">Applicants</th>
                <th className="px-4 py-3 font-medium">Closes</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((job) => {
                const stats = performance.get(job.id);
                return (
                  <tr key={job.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{job.title}</p>
                      <p className="text-xs text-muted">{job.location.name} · posted {formatDay(job.createdAt)}{job.postedByEmployer ? ` by ${job.postedByEmployer.name}` : ""}</p>
                    </td>
                    <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{stats?.views ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {job.applicationMethod === "ON_SITE" ? (
                        <Link className="text-ink hover:text-brand hover:underline" href={`/employer/applications?job=${job.id}`}>
                          {stats?.applications ?? 0}
                          {stats?.newApplications ? <span className="ml-1 text-xs text-brand">({stats.newApplications} new)</span> : null}
                        </Link>
                      ) : (
                        <span title="Candidates apply on your own site; this counts clicks to your link">{stats?.clicks ?? 0} clicks</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body">{formatDay(job.applicationDeadline)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {job.status === "PUBLISHED" ? (
                          <Link className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-ink hover:border-ink/30" href={`/jobs/${job.slug}`} target="_blank">View</Link>
                        ) : null}
                        {job.status !== "REJECTED" ? (
                          <Link className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-medium text-ink hover:border-ink/30" href={`/employer/jobs/${job.id}/edit`}>
                            {job.status === "CLOSED" || job.status === "EXPIRED" ? "Edit & reopen" : "Edit"}
                          </Link>
                        ) : null}
                        {job.status === "PUBLISHED" || job.status === "PENDING_REVIEW" ? (
                          <form action={closeEmployerJobAction.bind(null, job.id)}>
                            <ConfirmSubmit label="Close" message={`Close "${job.title}"? It will be removed from the site and stop taking applications.`} tone="danger" />
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!jobs.length ? <p className="px-6 py-12 text-center text-sm text-body">No jobs here yet.</p> : null}
      </div>
    </>
  );
}
