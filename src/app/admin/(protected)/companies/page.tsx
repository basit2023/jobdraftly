import { Building2, Pencil } from "lucide-react";
import Link from "next/link";

import { archiveCompanyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; verified?: string | string[]; page?: string | string[] }> }) {
  const raw = await searchParams;
  const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q ?? "").trim().slice(0, 120);
  const verified = String(Array.isArray(raw.verified) ? raw.verified[0] : raw.verified ?? "");
  const requestedPage = Math.max(1, Number(Array.isArray(raw.page) ? raw.page[0] : raw.page) || 1);
  const where = { ...(q ? { name: { contains: q } } : {}), ...(verified === "yes" ? { isVerified: true } : verified === "no" ? { isVerified: false } : {}) };
  const total = await db.company.count({ where });
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const companies = await db.company.findMany({ where, include: { location: true, _count: { select: { jobs: true } } }, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });

  return <>
    <AdminPageHeader action={{ href: "/admin/companies/new", label: "Add company" }} description="Maintain employer profiles, verification state, location, and public branding." icon={Building2} title="Companies" />
    <form className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto]" method="get"><input className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm" defaultValue={q} name="q" placeholder="Search company name" type="search" /><select className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" defaultValue={verified} name="verified"><option value="">All companies</option><option value="yes">Verified</option><option value="no">Not verified</option></select><button className="rounded-xl bg-[#0b1f3a] px-5 text-sm font-extrabold text-white" type="submit">Filter</button></form>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Company</th><th className="px-5 py-4">Industry / city</th><th className="px-5 py-4">Jobs</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{companies.map((company) => <tr key={company.id}><td className="px-5 py-4"><p className="font-extrabold text-[#0b1f3a]">{company.name}</p><p className="mt-1 text-xs text-slate-500">{company.domain ?? company.websiteUrl ?? "No website"}</p></td><td className="px-5 py-4 text-sm text-slate-600">{company.industry ?? "Not specified"}<span className="block text-xs text-slate-400">{company.location?.name ?? "No city"}</span></td><td className="px-5 py-4 font-bold text-slate-700">{company._count.jobs}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${company.isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{company.isVerified ? "Verified" : "Unverified"}</span>{!company.isActive ? <span className="ml-2 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">Inactive</span> : null}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Link className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700" href={`/admin/companies/${company.id}/edit`}><Pencil className="size-4" /></Link>{company.isActive ? <form action={archiveCompanyAction.bind(null, company.id)}><ConfirmSubmitButton label="Archive" message="Archive this company? Its public profile and jobs will be hidden." /></form> : null}</div></td></tr>)}</tbody></table></div>{!companies.length ? <p className="px-6 py-14 text-center text-sm text-slate-500">No companies match these filters.</p> : null}</div>
    {totalPages > 1 ? <nav className="mt-6 flex justify-end gap-2"><PageLink disabled={page === 1} href={companyPageHref(page - 1, q, verified)}>Previous</PageLink><span className="px-3 py-2 text-sm text-slate-500">Page {page} of {totalPages}</span><PageLink disabled={page === totalPages} href={companyPageHref(page + 1, q, verified)}>Next</PageLink></nav> : null}
  </>;
}

function companyPageHref(page: number, q: string, verified: string) { const params = new URLSearchParams(); if (q) params.set("q", q); if (verified) params.set("verified", verified); params.set("page", String(page)); return `/admin/companies?${params}`; }
function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) { return <Link aria-disabled={disabled} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href}>{children}</Link>; }
