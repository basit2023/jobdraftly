import { FolderTree } from "lucide-react";

import { createCategoryAction, toggleTaxonomyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { TaxonomyCreateForm } from "@/components/admin/taxonomy-create-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = await searchParams;
  const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q ?? "").trim().slice(0, 120);
  const categories = await db.jobCategory.findMany({ where: q ? { name: { contains: q } } : {}, include: { parent: true, _count: { select: { jobs: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const parents = await db.jobCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <><AdminPageHeader description="Maintain the public job taxonomy and safely deactivate categories without deleting related jobs." icon={FolderTree} title="Job categories" /><div className="grid gap-6 xl:grid-cols-[350px_1fr]"><TaxonomyCreateForm action={createCategoryAction} kind="category" parents={parents} /><section><SearchForm q={q} placeholder="Search categories" /><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Category</th><th className="px-5 py-4">Jobs</th><th className="px-5 py-4 text-right">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{categories.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="font-extrabold text-slate-800">{item.name}</p><p className="text-xs text-slate-400">{item.parent?.name ?? "Top level"}</p></td><td className="px-5 py-4">{item._count.jobs}</td><td className="px-5 py-4"><form action={toggleTaxonomyAction.bind(null, "category", item.id, !item.isActive)} className="flex justify-end"><ConfirmSubmitButton label={item.isActive ? "Deactivate" : "Activate"} message={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}?`} tone="neutral" /></form></td></tr>)}</tbody></table></div></section></div></>;
}

function SearchForm({ q, placeholder }: { q: string; placeholder: string }) { return <form className="mb-4 flex gap-2" method="get"><input className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm" defaultValue={q} name="q" placeholder={placeholder} type="search" /><button className="rounded-xl bg-[#0b1f3a] px-5 text-sm font-bold text-white">Search</button></form>; }
