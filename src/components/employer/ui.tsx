import type { ApplicationStatus, JobStatus } from "@/generated/prisma/client";
import { applicationStatusLabels } from "@/lib/validations/employer";

export const inputClass =
  "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand";
export const textareaClass = `${inputClass} min-h-32 py-2.5 leading-6`;

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-body">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{typeof value === "number" ? value.toLocaleString("en-PK") : value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const jobStatusStyle: Record<JobStatus, [string, string]> = {
  PUBLISHED: ["Live", "bg-brand-tint text-brand-dark"],
  PENDING_REVIEW: ["Waiting for approval", "bg-amber-50 text-amber-800"],
  DRAFT: ["Draft", "bg-slate-100 text-slate-700"],
  REJECTED: ["Rejected", "bg-red-50 text-red-700"],
  EXPIRED: ["Expired", "bg-slate-100 text-slate-600"],
  CLOSED: ["Closed", "bg-slate-100 text-slate-600"],
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const [label, style] = jobStatusStyle[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

const applicationStyle: Record<ApplicationStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  REVIEWING: "bg-slate-100 text-slate-700",
  SHORTLISTED: "bg-violet-50 text-violet-700",
  INTERVIEW: "bg-amber-50 text-amber-800",
  OFFERED: "bg-teal-50 text-teal-700",
  HIRED: "bg-brand-tint text-brand-dark",
  REJECTED: "bg-red-50 text-red-700",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${applicationStyle[status]}`}>{applicationStatusLabels[status]}</span>;
}

export function Field({ label, hint, error, wide = false, children }: { label: string; hint?: string; error?: string[]; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error?.length ? <span className="mt-1 block text-xs text-red-700">{error[0]}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const style = {
    info: "border-line bg-paper text-body",
    success: "border-brand/20 bg-brand-tint text-brand-dark",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return <div className={`rounded-md border p-3.5 text-sm leading-6 ${style}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function formatDay(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" }).format(value);
}

export function timeAgo(value: Date, now = new Date()) {
  const minutes = Math.round((now.getTime() - value.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : formatDay(value);
}
