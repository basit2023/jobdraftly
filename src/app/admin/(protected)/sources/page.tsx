import { Activity, ExternalLink, Play, Tags } from "lucide-react";

import {
  runSourceNowAction,
  updateSourceMonitoringAction,
} from "@/app/admin/monitoring/actions";
import {
  createSourceAction,
  setSourcePermissionAction,
  toggleTaxonomyAction,
} from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton, SubmitButton } from "@/components/admin/form-controls";
import { TaxonomyCreateForm } from "@/components/admin/taxonomy-create-form";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const input = "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs";

export default async function SourcesPage() {
  const [admin, sources] = await Promise.all([requireAdmin(), db.jobSource.findMany({
    include: {
      _count: { select: { jobs: true, jobImports: true, discoveries: true, monitorRuns: true } },
    },
    orderBy: { name: "asc" },
  })]);
  const canManage = admin.role === "SUPER_ADMIN" || admin.role === "ADMIN";

  return (
    <>
      <AdminPageHeader
        action={{ href: "/admin/monitoring", label: "Monitoring activity" }}
        description="Document permission, configure a permitted endpoint, and control each source independently. Enabling a source does not prove its connector works until a real scan succeeds."
        icon={Tags}
        title="Job sources"
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {canManage ? <TaxonomyCreateForm action={createSourceAction} kind="source" /> : (
          <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            Source configuration is read-only for editors. An administrator role is required to change permissions, endpoints, schedules, or source status.
          </aside>
        )}
        <div className="space-y-5">
          {sources.map((item) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-extrabold text-slate-800">{item.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${item.permissionStatus === "APPROVED" ? "bg-emerald-50 text-emerald-700" : item.permissionStatus === "PENDING_REVIEW" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                      {item.permissionStatus.replaceAll("_", " ")}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${item.monitoringEnabled ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {item.monitoringEnabled ? "MONITORING ENABLED" : "MONITORING OFF"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.type.replaceAll("_", " ")} · {item._count.jobs} jobs · {item._count.discoveries} discoveries · {item._count.monitorRuns} scans</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-blue-700">
                    {item.baseUrl ? <a className="inline-flex items-center gap-1" href={item.baseUrl} rel="noreferrer" target="_blank">Source site <ExternalLink className="size-3" /></a> : null}
                    {item.termsUrl ? <a className="inline-flex items-center gap-1" href={item.termsUrl} rel="noreferrer" target="_blank">Terms evidence <ExternalLink className="size-3" /></a> : null}
                  </div>
                </div>
                {canManage ? <div className="flex flex-wrap gap-2">
                  {item.permissionStatus !== "APPROVED" ? (
                    <form action={setSourcePermissionAction.bind(null, item.id, true)}><ConfirmSubmitButton label="Approve" message={`Confirm documented permission for ${item.name}?`} tone="neutral" /></form>
                  ) : (
                    <form action={setSourcePermissionAction.bind(null, item.id, false)}><ConfirmSubmitButton label="Revoke" message={`Revoke permission and disable ${item.name}?`} /></form>
                  )}
                  <form action={toggleTaxonomyAction.bind(null, "source", item.id, !item.isActive)}><ConfirmSubmitButton label={item.isActive ? "Deactivate" : "Activate"} message={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}?`} tone="neutral" /></form>
                </div> : null}
              </div>

              <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-3">
                <div><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Last successful scan</p><p className="mt-1 text-xs font-bold text-slate-700">{formatDate(item.lastSuccessfulScanAt) ?? "Never tested"}</p></div>
                <div><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Next scan</p><p className="mt-1 text-xs font-bold text-slate-700">{formatDate(item.nextScanAt) ?? "Not scheduled"}</p></div>
                <div><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Health</p><p className={`mt-1 text-xs font-bold ${item.consecutiveFailures ? "text-red-700" : "text-emerald-700"}`}>{item.consecutiveFailures ? `${item.consecutiveFailures} consecutive failures` : item.lastSuccessfulScanAt ? "Healthy" : "Untested"}</p></div>
              </div>
              {item.lastMonitorError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{item.lastMonitorError}</p> : null}

              {canManage ? <form action={updateSourceMonitoringAction.bind(null, item.id)} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
                <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Mode
                  <select className={input} defaultValue={item.monitoringMode} name="monitoringMode">
                    <option value="DISABLED">Disabled</option><option value="API">Approved JSON API</option><option value="RSS">Permitted RSS / Atom</option><option value="WEB_PAGE">Permitted web page</option>
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Frequency (minutes)
                  <input className={`${input} w-32`} defaultValue={item.monitoringIntervalMinutes} max="43200" min="5" name="monitoringIntervalMinutes" type="number" />
                </label>
                <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Rate limit / minute
                  <input className={`${input} w-28`} defaultValue={item.rateLimitPerMinute} max="60" min="1" name="rateLimitPerMinute" type="number" />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><input defaultChecked={item.monitoringEnabled} name="monitoringEnabled" type="checkbox" /> Enabled</label>
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900" title="When on, AI-extracted jobs from this source go live without review if they are complete and the AI is confident. Otherwise they wait in Jobs → Pending review."><input defaultChecked={item.autoPublish} name="autoPublish" type="checkbox" /> Trusted: auto-publish AI jobs</label>
                <SubmitButton label="Save monitoring" />
              </form> : null}
              {canManage && item.monitoringEnabled ? (
                <form action={runSourceNowAction.bind(null, item.id)} className="mt-3">
                  <button className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700" type="submit"><Play className="size-3" /> Run authorized check now</button>
                </form>
              ) : null}
            </article>
          ))}
          {!sources.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500"><Activity className="mx-auto mb-3 size-6" />No sources configured.</div> : null}
        </div>
      </div>
    </>
  );
}
