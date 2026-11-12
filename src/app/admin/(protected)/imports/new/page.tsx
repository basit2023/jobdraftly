import { DatabaseZap, ShieldCheck } from "lucide-react";

import { stageConnectorImportAction } from "@/app/admin/imports/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CsvUploadForm } from "@/components/admin/csv-upload-form";
import { SubmitButton } from "@/components/admin/form-controls";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewImportPage() {
  const sources = await db.jobSource.findMany({ where: { isActive: true, permissionStatus: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, feedUrl: true } });
  const csvSources = sources.filter((source) => ["CSV", "EMPLOYER_WEBSITE", "JOB_BOARD", "GOVERNMENT_PORTAL"].includes(source.type));
  const connectors = sources.filter((source) => source.feedUrl && ["API", "XML_FEED"].includes(source.type));
  return <>
    <AdminPageHeader action={{ href: "/admin/imports", label: "Back to imports" }} description="Stage genuine vacancies from permitted sources, inspect every row, and send valid records to review." icon={DatabaseZap} title="New job import" />
    <div className="grid gap-6 xl:grid-cols-2"><CsvUploadForm sources={csvSources} /><section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><h2 className="text-lg font-extrabold text-[#0b1f3a]">Approved API or RSS feed</h2><p className="mt-1 text-sm leading-6 text-slate-500">Only active sources marked Approved with an HTTPS endpoint can be contacted.</p></div>{connectors.length ? <form action={stageConnectorImportAction} className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Connector</span><select className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" name="sourceId" required><option value="">Select connector</option>{connectors.map((source) => <option key={source.id} value={source.id}>{source.name} ({source.type === "API" ? "API" : "RSS"})</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Import method</span><select className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" name="method" required><option value="API">Approved JSON API</option><option value="RSS">Permitted RSS / Atom feed</option></select></label><SubmitButton label="Fetch and stage records" /></form> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Add an API or XML feed source, document its terms, configure its HTTPS endpoint, and approve permission before importing.</div>}</section></div>
    <aside className="mt-6 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-950"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p><strong>Ethical import boundary:</strong> JobDraftly never bypasses logins, paywalls, CAPTCHAs, robots restrictions, or access controls. Source attribution is retained and imported vacancies are never automatically verified or published.</p></aside>
  </>;
}

