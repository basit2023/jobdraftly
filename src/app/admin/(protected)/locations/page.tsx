import { MapPinned } from "lucide-react";

import { createLocationAction, toggleTaxonomyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { TaxonomyCreateForm } from "@/components/admin/taxonomy-create-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[] }> }) {
  const raw = await searchParams;
  const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q ?? "").trim().slice(0, 120);
  const type = String(Array.isArray(raw.type) ? raw.type[0] : raw.type ?? "");
  const locations = await db.jobLocation.findMany({ where: { ...(q ? { name: { contains: q } } : {}), ...(type === "CITY" || type === "PROVINCE" ? { type } : {}) }, include: { province: true, _count: { select: { jobs: true, companies: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] });
  const provinces = await db.jobLocation.findMany({ where: { type: "PROVINCE", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <><AdminPageHeader description="Manage Pakistan provinces and cities used by jobs and company profiles." icon={MapPinned} title="Locations" /><div className="grid gap-6 xl:grid-cols-[350px_1fr]"><TaxonomyCreateForm action={createLocationAction} kind="location" parents={provinces} /><section><form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]" method="get"><input className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm" defaultValue={q} name="q" placeholder="Search locations" type="search" /><select className="rounded-xl border border-slate-200 bg-white px-3 text-sm" defaultValue={type} name="type"><option value="">All types</option><option value="PROVINCE">Provinces</option><option value="CITY">Cities</option></select><button className="rounded-xl bg-[#0b1f3a] px-5 text-sm font-bold text-white">Filter</button></form><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Location</th><th className="px-5 py-4">Usage</th><th className="px-5 py-4 text-right">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{locations.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="font-extrabold text-slate-800">{item.name}</p><p className="text-xs text-slate-400">{item.type}{item.province ? ` · ${item.province.name}` : ""}</p></td><td className="px-5 py-4 text-xs text-slate-600">{item._count.jobs} jobs · {item._count.companies} companies</td><td className="px-5 py-4"><form action={toggleTaxonomyAction.bind(null, "location", item.id, !item.isActive)} className="flex justify-end"><ConfirmSubmitButton label={item.isActive ? "Deactivate" : "Activate"} message={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}?`} tone="neutral" /></form></td></tr>)}</tbody></table></div></section></div></>;
}
