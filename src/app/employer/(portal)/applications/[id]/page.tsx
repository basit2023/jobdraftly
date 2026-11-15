import { Download, ExternalLink, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveApplicationNotesAction, updateApplicationStatusAction } from "@/app/employer/actions";
import { NotesForm } from "@/components/employer/notes-form";
import { ApplicationStatusBadge, Card, formatDay, JobStatusBadge } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { getEmployerApplication } from "@/lib/services/applications";
import { applicationStatuses, applicationStatusLabels } from "@/lib/validations/employer";

export const metadata: Metadata = { title: "Applicant" };

function fileSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function EmployerApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const employer = await requireEmployer();
  const { id } = await params;
  const application = await getEmployerApplication(employer, id);
  if (!application) notFound();
  const whatsapp = application.phone.replace(/[^0-9]/g, "").replace(/^0/, "92");

  return (
    <>
      <Link className="text-sm text-muted hover:text-ink" href={`/employer/applications?job=${application.job.id}`}>← Applicants for {application.job.title}</Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{application.fullName}</h1>
          <p className="mt-1 text-sm text-body">
            Applied for <span className="font-medium text-ink">{application.job.title}</span> on {formatDay(application.createdAt)}
            {application.city ? ` · ${application.city}` : ""}
          </p>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="CV">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-body">
                {application.cvFileName} <span className="text-muted">· {fileSize(application.cvSizeBytes)}</span>
              </p>
              <div className="flex gap-2">
                {application.cvMimeType === "application/pdf" ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium text-ink hover:border-ink/30" href={`/api/employer/applications/${application.id}/cv?inline=1`} rel="noopener" target="_blank">
                    <ExternalLink aria-hidden="true" className="size-4" /> Open
                  </a>
                ) : null}
                <a className="inline-flex min-h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-brand" href={`/api/employer/applications/${application.id}/cv`}>
                  <Download aria-hidden="true" className="size-4" /> Download
                </a>
              </div>
            </div>
          </Card>

          {application.coverLetter ? (
            <Card title="Cover letter">
              <p className="whitespace-pre-line text-sm leading-7 text-body">{application.coverLetter}</p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card title="Contact">
            <ul className="space-y-2.5 text-sm">
              <li><a className="inline-flex items-center gap-2 text-ink hover:text-brand" href={`mailto:${application.email}`}><Mail aria-hidden="true" className="size-4 text-muted" />{application.email}</a></li>
              <li><a className="inline-flex items-center gap-2 text-ink hover:text-brand" href={`tel:${application.phone.replace(/\s/g, "")}`}><Phone aria-hidden="true" className="size-4 text-muted" />{application.phone}</a></li>
              {whatsapp.length >= 11 ? (
                <li><a className="text-sm text-brand hover:underline" href={`https://wa.me/${whatsapp}`} rel="noopener noreferrer" target="_blank">Message on WhatsApp</a></li>
              ) : null}
            </ul>
          </Card>

          <Card title="Stage">
            <form action={updateApplicationStatusAction.bind(null, application.id)} className="grid grid-cols-2 gap-2">
              {applicationStatuses.map((status) => (
                <button
                  aria-pressed={application.status === status}
                  className={`min-h-9 rounded-md border px-2 text-xs font-medium ${application.status === status ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink/30"}`}
                  key={status}
                  name="status"
                  type="submit"
                  value={status}
                >
                  {applicationStatusLabels[status]}
                </button>
              ))}
            </form>
            {application.statusChangedAt ? <p className="mt-3 text-xs text-muted">Last changed {formatDay(application.statusChangedAt)}</p> : null}
            <p className="mt-2 text-xs leading-5 text-muted">The candidate isn&apos;t notified automatically — contact them directly.</p>
          </Card>

          <Card title="Team notes">
            <NotesForm action={saveApplicationNotesAction.bind(null, application.id)} defaultValue={application.employerNotes ?? ""} />
          </Card>

          <Card title="Job">
            <div className="flex items-center justify-between gap-3">
              <Link className="text-sm font-medium text-ink hover:text-brand" href={`/employer/jobs/${application.job.id}/edit`}>{application.job.title}</Link>
              <JobStatusBadge status={application.job.status} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
