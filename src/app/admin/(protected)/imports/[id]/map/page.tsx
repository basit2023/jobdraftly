import { ArrowRight, Columns3 } from "lucide-react";
import { notFound } from "next/navigation";

import { validateImportMappingAction } from "@/app/admin/imports/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SubmitButton } from "@/components/admin/form-controls";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { importFieldLabels, importFields, requiredImportFields, type ColumnMapping } from "@/lib/imports/fields";

function objectValue(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export default async function ImportMappingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const jobImport = await db.jobImport.findUnique({ where: { id }, include: { source: true, rows: { take: 3, orderBy: { rowNumber: "asc" } } } });
  if (!jobImport) notFound();
  const headers = Object.keys(objectValue(jobImport.rows[0]?.rawData ?? {}));
  const mapping = objectValue(jobImport.columnMapping ?? {}) as ColumnMapping;
  const required = new Set<string>(requiredImportFields);
  return <>
    <AdminPageHeader description={`Map columns from ${jobImport.fileName}. Validation does not create jobs.`} icon={Columns3} title="Map import columns" />
    {query.error ? <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{query.error}</p> : null}
    <form action={validateImportMappingAction.bind(null, id)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{importFields.map((field) => <label className="block" key={field}><span className="mb-1.5 block text-xs font-bold text-slate-600">{importFieldLabels[field]} {required.has(field) ? <span className="text-red-600">*</span> : null}</span><select className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" defaultValue={mapping[field] ?? ""} name={field} required={required.has(field)}><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="mt-6"><SubmitButton label="Validate and preview" /></div></form>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-[#0b1f3a]">Raw sample</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{headers.map((header) => <th className="whitespace-nowrap px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{jobImport.rows.map((row) => { const values = objectValue(row.rawData); return <tr className="border-t border-slate-100" key={row.id}>{headers.map((header) => <td className="max-w-64 truncate px-4 py-3" key={header}>{String(values[header] ?? "")}</td>)}</tr>; })}</tbody></table></div></section>
    <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ArrowRight className="size-3.5" /> Next: review validation errors and duplicates before confirming the import.</p>
  </>;
}

