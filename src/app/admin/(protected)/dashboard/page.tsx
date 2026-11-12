import { Activity, BarChart3, BriefcaseBusiness, Building2, CalendarCheck2, Clock3, Eye, FilePenLine, Link2, MapPin, Radar, ShieldAlert, Sparkles } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [total, published, drafts, pending, expiredStatus, expiredByDate, companies, thisMonth, recentAudit,
    newDiscoveries, awaitingVerification, monitoredSources, unhealthySources, extractionSuccess, extractionFailure,
    failedImports, failedMonitorRuns, applicationClicks, topJobViews, topLocationSearches] = await Promise.all([
    db.job.count(),
    db.job.count({ where: { status: "PUBLISHED", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.job.count({ where: { status: "DRAFT" } }),
    db.job.count({ where: { status: "PENDING_REVIEW" } }),
    db.job.count({ where: { status: "EXPIRED" } }),
    db.job.count({ where: { status: "PUBLISHED", expiresAt: { lte: now } } }),
    db.company.count(),
    db.job.count({ where: { status: "PUBLISHED", publishedAt: { gte: monthStart } } }),
    db.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { admin: { select: { name: true } } } }),
    db.sourceDiscovery.count({ where: { type: "JOB", status: "NEW" } }),
    db.job.count({ where: { OR: [{ status: "PENDING_REVIEW" }, { jobImportId: { not: null }, verificationStatus: "UNVERIFIED" }] } }),
    db.jobSource.count({ where: { isActive: true, monitoringEnabled: true } }),
    db.jobSource.count({ where: { isActive: true, monitoringEnabled: true, OR: [{ consecutiveFailures: { gt: 0 } }, { lastMonitorError: { not: null } }] } }),
    db.sourceDocument.count({ where: { extractionStatus: "SUCCEEDED" } }),
    db.sourceDocument.count({ where: { extractionStatus: "FAILED" } }),
    db.jobImport.count({ where: { status: "FAILED" } }),
    db.sourceMonitorRun.count({ where: { status: "FAILED" } }),
    db.analyticsEvent.count({ where: { type: "APPLICATION_LINK_CLICK" } }),
    db.analyticsEvent.groupBy({ by: ["jobId"], where: { type: "JOB_VIEW", jobId: { not: null } }, _count: { _all: true }, orderBy: { _count: { jobId: "desc" } }, take: 5 }),
    db.analyticsEvent.groupBy({ by: ["locationSlug"], where: { type: "SEARCH", locationSlug: { not: null } }, _count: { _all: true }, orderBy: { _count: { locationSlug: "desc" } }, take: 5 }),
  ]);
  const [viewedJobs, searchedLocations] = await Promise.all([
    db.job.findMany({ where: { id: { in: topJobViews.map((item) => item.jobId).filter((id): id is string => Boolean(id)) } }, select: { id: true, title: true, slug: true } }),
    db.jobLocation.findMany({ where: { slug: { in: topLocationSearches.map((item) => item.locationSlug).filter((slug): slug is string => Boolean(slug)) } }, select: { slug: true, name: true } }),
  ]);
  const jobById = new Map(viewedJobs.map((job) => [job.id, job]));
  const locationBySlug = new Map(searchedLocations.map((location) => [location.slug, location]));
  const extractionTotal = extractionSuccess + extractionFailure;
  const extractionRate = extractionTotal ? `${Math.round((extractionSuccess / extractionTotal) * 100)}%` : "—";
  const failedIngestion = failedImports + failedMonitorRuns + extractionFailure;
  const stats = [
    ["Total jobs", total, BriefcaseBusiness, "bg-blue-50 text-blue-700"],
    ["Published", published, CalendarCheck2, "bg-emerald-50 text-emerald-700"],
    ["Drafts", drafts, FilePenLine, "bg-slate-100 text-slate-700"],
    ["Pending review", pending, Clock3, "bg-amber-50 text-amber-700"],
    ["Expired", expiredStatus + expiredByDate, ShieldAlert, "bg-red-50 text-red-700"],
    ["Companies", companies, Building2, "bg-violet-50 text-violet-700"],
    ["Published this month", thisMonth, BarChart3, "bg-cyan-50 text-cyan-700"],
  ] as const;
  const launchStats = [
    ["Active jobs", published, BriefcaseBusiness, "bg-emerald-50 text-emerald-700", "Published and not expired"],
    ["New jobs discovered", newDiscoveries, Radar, "bg-blue-50 text-blue-700", "Awaiting discovery review"],
    ["Awaiting verification", awaitingVerification, ShieldAlert, "bg-amber-50 text-amber-700", "Jobs requiring human checks"],
    ["Published announcements", "—", CalendarCheck2, "bg-slate-100 text-slate-700", "Announcement publishing is not implemented"],
    ["Expired jobs", expiredStatus + expiredByDate, Clock3, "bg-red-50 text-red-700", "Status or deadline expired"],
    ["Source health", monitoredSources ? `${monitoredSources - unhealthySources}/${monitoredSources}` : "—", Activity, "bg-cyan-50 text-cyan-700", "Healthy monitored sources"],
    ["AI extraction success", extractionRate, Sparkles, "bg-violet-50 text-violet-700", `${extractionTotal} completed attempts`],
    ["Failed ingestion tasks", failedIngestion, ShieldAlert, "bg-red-50 text-red-700", "Imports, monitors, and extraction"],
    ["Application-link clicks", applicationClicks, Link2, "bg-indigo-50 text-indigo-700", "Outbound clicks, not applications"],
  ] as const;

  return (
    <>
      <AdminPageHeader description="A live operational view of vacancies, review work, and important administrator activity." icon={BarChart3} title="Dashboard" />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon, color]) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
            <span className={`grid size-10 place-items-center rounded-xl ${color}`}><Icon aria-hidden="true" className="size-5" /></span>
            <p className="mt-5 text-3xl font-extrabold tracking-tight text-[#0b1f3a]">{value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </section>
      <section className="mt-8">
        <div className="mb-4"><h2 className="text-xl font-extrabold text-[#0b1f3a]">Launch operations</h2><p className="mt-1 text-sm text-slate-500">First-party aggregate metrics contain no raw search text or visitor identity.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {launchStats.map(([label, value, Icon, color, detail]) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
              <div className="flex items-center justify-between gap-3"><span className={`grid size-10 place-items-center rounded-xl ${color}`}><Icon aria-hidden="true" className="size-5" /></span><p className="text-2xl font-extrabold text-[#0b1f3a]">{value}</p></div>
              <p className="mt-4 text-sm font-extrabold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <MetricList
          empty="No public job views have been recorded."
          icon={Eye}
          items={topJobViews.flatMap((item) => { const job = item.jobId ? jobById.get(item.jobId) : null; return job ? [{ label: job.title, value: item._count._all }] : []; })}
          title="Most viewed jobs"
        />
        <MetricList
          empty="No location searches have been recorded."
          icon={MapPin}
          items={topLocationSearches.flatMap((item) => { const location = item.locationSlug ? locationBySlug.get(item.locationSlug) : null; return location ? [{ label: location.name, value: item._count._all }] : []; })}
          title="Most searched locations"
        />
      </section>
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-extrabold text-[#0b1f3a]">Recent audit activity</h2><p className="mt-1 text-sm text-slate-500">Important administrator actions are recorded here.</p></div>
        {recentAudit.length ? (
          <ul className="divide-y divide-slate-100">
            {recentAudit.map((entry) => <li className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between" key={entry.id}><div><p className="text-sm font-bold text-slate-800">{entry.summary}</p><p className="mt-0.5 text-xs text-slate-500">{entry.admin?.name ?? "Former administrator"} · {entry.action}</p></div><time className="text-xs text-slate-400">{formatDate(entry.createdAt)}</time></li>)}
          </ul>
        ) : <p className="px-6 py-10 text-center text-sm text-slate-500">No audit activity has been recorded yet.</p>}
      </section>
    </>
  );
}

function MetricList({ title, empty, icon: Icon, items }: { title: string; empty: string; icon: typeof Eye; items: { label: string; value: number }[] }) {
  return <article className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5"><Icon aria-hidden="true" className="size-5 text-blue-600" /><h2 className="text-lg font-extrabold text-[#0b1f3a]">{title}</h2></div>{items.length ? <ol className="divide-y divide-slate-100">{items.map((item) => <li className="flex items-center justify-between gap-4 px-6 py-4" key={item.label}><span className="truncate text-sm font-bold text-slate-700">{item.label}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">{item.value}</span></li>)}</ol> : <p className="px-6 py-10 text-center text-sm text-slate-500">{empty}</p>}</article>;
}
