import { CheckCircle2, DatabaseZap, ExternalLink, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { confirmImportAction } from "@/app/admin/imports/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

function record(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function errors(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function ImportPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ completed?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const jobImport = await db.jobImport.findUnique({ where: { id }, include: { source: true, rows: { orderBy: { rowNumber: "asc" } } } });
  if (!jobImport) notFound();
  const valid = jobImport.rows.filter((row) => row.status === "VALID").length;
  const completed = ["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(jobImport.status);
  return <>
    <AdminPageHeader action={{ href: "/admin/imports", label: "Import history" }} description={`${jobImport.source.name} · ${jobImport.method} · ${jobImport.fileName}`} icon={DatabaseZap} title={completed ? "Import result" : "Import preview"} />
    {query.completed ? <div className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="size-5 shrink-0" />Import complete. Created vacancies are in Pending Review and are not public.</div> : null}
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Total rows", jobImport.totalRows], ["Ready", completed ? jobImport.importedRows : valid], ["Duplicates", jobImport.duplicateRows], ["Rejected", jobImport.rejectedRows]].map(([label, value]) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={String(label)}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold text-[#0b1f3a]">{value}</p></div>)}</div>
    {!completed && valid ? <form action={confirmImportAction.bind(null, id)} className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5"><div><p className="font-extrabold text-blue-950">Create {valid} pending-review {valid === 1 ? "vacancy" : "vacancies"}</p><p className="mt-1 text-xs text-blue-800">Duplicates and invalid rows will not be created.</p></div><ConfirmSubmitButton label="Confirm import" message={`Create ${valid} jobs in Pending Review?`} tone="neutral" /></form> : null}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Vacancy</th><th className="px-4 py-3">Company / city</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{jobImport.rows.map((row) => { const data = record(row.normalizedData); const rowErrors = errors(row.errorMessages); return <tr key={row.id}><td className="px-4 py-4 text-xs text-slate-500">{row.rowNumber}</td><td className="px-4 py-4"><p className="font-bold text-slate-800">{String(data.title ?? "Unmapped")}</p>{data.sourceUrl ? <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-700" href={String(data.sourceUrl)} rel="noreferrer" target="_blank">Source <ExternalLink className="size-3" /></a> : null}</td><td className="px-4 py-4 text-xs text-slate-600">{String(data.company ?? "—")}<br />{String(data.city ?? "—")}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${row.status === "VALID" || row.status === "IMPORTED" ? "bg-emerald-50 text-emerald-700" : row.status === "DUPLICATE" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{row.status}</span></td><td className="max-w-md px-4 py-4 text-xs text-slate-600">{rowErrors.length ? <ul className="space-y-1">{rowErrors.map((error) => <li className="flex gap-1.5" key={error}><TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-600" />{error}</li>)}</ul> : "Passed validation"}{row.duplicateJobId ? <Link className="mt-2 block font-bold text-blue-700" href={`/admin/jobs/${row.duplicateJobId}/edit`}>Open matching job</Link> : null}</td></tr>; })}</tbody></table></div></section>
  </>;
}

