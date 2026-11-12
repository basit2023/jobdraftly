import { Bell, ExternalLink, FileSearch, Radar } from "lucide-react";
import Link from "next/link";

import {
  applyDiscoveryToRelatedJobAction,
  markNotificationReadAction,
  retryDocumentExtractionAction,
  setDiscoveryReviewAction,
  stageDiscoveryAsJobAction,
} from "@/app/admin/monitoring/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/formatters";
import { extractionIsConfigured } from "@/lib/monitoring/extraction";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const [discoveries, runs, notifications, unread] = await Promise.all([
    db.sourceDiscovery.findMany({
      include: { source: true, relatedJob: { select: { id: true, title: true } }, documents: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.sourceMonitorRun.findMany({ include: { source: true }, orderBy: { startedAt: "desc" }, take: 20 }),
    db.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.adminNotification.count({ where: { readAt: null } }),
  ]);
  const extractionConfigured = extractionIsConfigured();

  return (
    <>
      <AdminPageHeader action={{ href: "/admin/sources", label: "Configure sources" }} description="Review discoveries and changes before they enter the import or publication workflow. No monitor publishes content automatically." icon={Radar} title="Source monitoring" />
      <div className={`mb-6 rounded-xl border p-4 text-sm ${extractionConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        OCR/AI extraction adapter: <strong>{extractionConfigured ? "configured (real endpoint still requires a successful document test)" : "not configured"}</strong>.
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-extrabold text-[#0b1f3a]">Discovered records</h2><p className="mt-1 text-sm text-slate-500">Newest jobs, announcements, documents, and detected changes.</p></div>
        {discoveries.length ? <div className="divide-y divide-slate-100">{discoveries.map((item) => (
          <article className="grid gap-4 px-6 py-5 xl:grid-cols-[1fr_1fr_auto]" key={item.id}>
            <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700">{item.type.replaceAll("_", " ")}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600">{item.status}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">{item.latestChangeType.replaceAll("_", " ")}</span></div><h3 className="mt-2 font-extrabold text-slate-800">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{item.source.name} · discovered {formatDate(item.firstSeenAt)}</p>{item.summary ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{item.summary}</p> : null}</div>
            <div className="text-xs leading-6 text-slate-600"><a className="inline-flex items-center gap-1 font-bold text-blue-700" href={item.canonicalUrl} rel="noreferrer" target="_blank">Inspect original <ExternalLink className="size-3" /></a><p><strong>Published:</strong> {formatDate(item.sourcePublishedAt) ?? "Not supplied"}</p><p><strong>Deadline:</strong> {formatDate(item.deadline) ?? "Not supplied"}</p><p><strong>Extraction:</strong> {item.extractionStatus.replaceAll("_", " ")}{item.confidenceScore ? ` · ${Math.round(Number(item.confidenceScore) * 100)}% confidence` : ""}</p>{item.relatedJob ? <Link className="font-bold text-blue-700" href={`/admin/jobs/${item.relatedJob.id}/edit`}>Possible existing job: {item.relatedJob.title}</Link> : null}{item.documents.map((document) => <div className="mt-1 flex items-center gap-2" key={document.id}><FileSearch className="size-3" /><a className="font-bold text-blue-700" href={document.url} rel="noreferrer" target="_blank">Document</a><span>{document.extractionStatus}</span>{document.extractionStatus === "FAILED" || document.extractionStatus === "NOT_CONFIGURED" ? <form action={retryDocumentExtractionAction.bind(null, document.id)}><button className="font-bold text-blue-700" type="submit">Retry</button></form> : null}</div>)}</div>
            <div className="flex flex-wrap content-start justify-end gap-2">{item.type === "JOB" && item.status !== "DISMISSED" ? <form action={stageDiscoveryAsJobAction.bind(null, item.id)}><ConfirmSubmitButton label="Stage as job" message="Send this discovery to column mapping and review?" tone="neutral" /></form> : null}{item.relatedJob && ["DEADLINE_CHANGED", "CANCELLED", "REMOVED"].includes(item.latestChangeType) ? <form action={applyDiscoveryToRelatedJobAction.bind(null, item.id)}><ConfirmSubmitButton label="Apply to job" message="Apply this reviewed deadline or closure change to the linked job?" tone="neutral" /></form> : null}<form action={setDiscoveryReviewAction.bind(null, item.id, "REVIEWED")}><ConfirmSubmitButton label="Reviewed" message="Mark this source record reviewed?" tone="neutral" /></form><form action={setDiscoveryReviewAction.bind(null, item.id, "DISMISSED")}><ConfirmSubmitButton label="Dismiss" message="Dismiss this discovery without publication?" /></form></div>
          </article>
        ))}</div> : <p className="px-6 py-12 text-center text-sm text-slate-500">No records have been discovered. This does not mean any named connector is operational.</p>}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-extrabold text-[#0b1f3a]">Recent source health</h2></div><div className="divide-y divide-slate-100">{runs.map((run) => <div className="flex items-start justify-between gap-3 px-6 py-4 text-xs" key={run.id}><div><p className="font-extrabold text-slate-800">{run.source.name}</p><p className="mt-1 text-slate-500">{formatDate(run.startedAt)} · {run.discoveredCount} new · {run.changedCount} changed</p>{run.errorMessage ? <p className="mt-1 text-red-700">{run.errorMessage}</p> : null}</div><span className={`rounded-full px-2 py-1 font-extrabold ${run.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : run.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{run.status}</span></div>)}{!runs.length ? <p className="p-6 text-sm text-slate-500">No source checks have run.</p> : null}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="flex items-center gap-2 font-extrabold text-[#0b1f3a]"><Bell className="size-4" /> Admin notifications</h2><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-extrabold text-blue-700">{unread} unread</span></div><div className="divide-y divide-slate-100">{notifications.map((notification) => <div className={`px-6 py-4 text-xs ${notification.readAt ? "opacity-60" : ""}`} key={notification.id}><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold text-slate-800">{notification.title}</p><p className="mt-1 leading-5 text-slate-600">{notification.message}</p><p className="mt-1 text-slate-400">{formatDate(notification.createdAt)}</p></div>{!notification.readAt ? <form action={markNotificationReadAction.bind(null, notification.id)}><button className="font-bold text-blue-700" type="submit">Mark read</button></form> : null}</div></div>)}{!notifications.length ? <p className="p-6 text-sm text-slate-500">No monitoring notifications.</p> : null}</div></section>
      </div>
    </>
  );
}
