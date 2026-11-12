import { BriefcaseBusiness, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";

import { archiveJobAction, setJobFeaturedAction, setJobPublishedAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type Search = { q?: string | string[]; status?: string | string[]; page?: string | string[] };
const statuses = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "EXPIRED", "CLOSED"] as const;

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q ?? "").trim().slice(0, 120);
  const statusRaw = String(Array.isArray(raw.status) ? raw.status[0] : raw.status ?? "");
  const status = statuses.includes(statusRaw as (typeof statuses)[number]) ? statusRaw as (typeof statuses)[number] : undefined;
  const requestedPage = Math.max(1, Math.min(10_000, Number(Array.isArray(raw.page) ? raw.page[0] : raw.page) || 1));
  const where = { ...(status ? { status } : {}), ...(q ? { OR: [{ title: { contains: q } }, { company: { name: { contains: q } } }] } : {}) };
  const total = await db.job.count({ where });
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const jobs = await db.job.findMany({ where, include: { company: true, location: true, source: true }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });

  return (
    <>
      <AdminPageHeader action={{ href: "/admin/jobs/new", label: "Create job" }} description="Search, review, publish, feature, or safely archive every vacancy." icon={BriefcaseBusiness} title="Job management" />
      <form className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto]" method="get">
        <input className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400" defaultValue={q} name="q" placeholder="Search title or company" type="search" />
        <select className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" defaultValue={status ?? ""} name="status"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <button className="rounded-xl bg-[#0b1f3a] px-5 text-sm font-extrabold text-white" type="submit">Filter jobs</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Job</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Source</th><th className="px-5 py-4">Deadline</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
          {jobs.map((job) => <tr key={job.id}><td className="px-5 py-4"><p className="font-extrabold text-[#0b1f3a]">{job.title}</p><p className="mt-1 text-xs text-slate-500">{job.company.name} · {job.location.name}{job.jobImportId ? " · Imported" : ""}</p></td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{job.status.replaceAll("_", " ")}</span>{job.isFeatured ? <span className="ml-2 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Featured</span> : null}</td><td className="px-5 py-4 text-xs text-slate-600">{job.source?.name ?? "Manual"}</td><td className="px-5 py-4 text-xs text-slate-600">{formatDate(job.applicationDeadline) ?? "Not set"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Link className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700" href={`/admin/jobs/${job.id}/edit`} title="Edit"><Pencil className="size-4" /></Link>{job.status === "PUBLISHED" ? <Link className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700" href={`/jobs/${job.slug}`} target="_blank" title="View public job"><ExternalLink className="size-4" /></Link> : null}<form action={setJobPublishedAction.bind(null, job.id, job.status !== "PUBLISHED")}><ConfirmSubmitButton label={job.status === "PUBLISHED" ? "Unpublish" : "Publish"} message={`${job.status === "PUBLISHED" ? "Unpublish" : "Publish"} this job?`} tone="neutral" /></form>{job.status === "PUBLISHED" ? <form action={setJobFeaturedAction.bind(null, job.id, !job.isFeatured)}><ConfirmSubmitButton label={job.isFeatured ? "Unfeature" : "Feature"} message={`${job.isFeatured ? "Remove" : "Add"} featured placement?`} tone="neutral" /></form> : null}<form action={archiveJobAction.bind(null, job.id)}><ConfirmSubmitButton label="Archive" message="Archive this vacancy? It will immediately disappear from public results." /></form></div></td></tr>)}
        </tbody></table></div>
        {!jobs.length ? <p className="px-6 py-14 text-center text-sm text-slate-500">No jobs match these filters.</p> : null}
      </div>
      <Pagination page={page} totalPages={totalPages} q={q} status={status ?? ""} />
    </>
  );
}

function Pagination({ page, totalPages, q, status }: { page: number; totalPages: number; q: string; status: string }) {
  if (totalPages <= 1) return null;
  const href = (next: number) => { const params = new URLSearchParams(); if (q) params.set("q", q); if (status) params.set("status", status); params.set("page", String(next)); return `/admin/jobs?${params}`; };
  return <nav aria-label="Job pages" className="mt-6 flex justify-end gap-2"><Link aria-disabled={page === 1} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href(Math.max(1, page - 1))}>Previous</Link><span className="px-3 py-2 text-sm text-slate-500">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href(Math.min(totalPages, page + 1))}>Next</Link></nav>;
}
