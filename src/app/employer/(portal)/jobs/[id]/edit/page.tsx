import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { saveEmployerJobAction } from "@/app/employer/actions";
import { EmployerJobForm } from "@/components/employer/employer-job-form";
import { JobStatusBadge, Notice, PageTitle } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { getEmployerJobFormOptions } from "@/lib/services/employer-form-options";
import { findEmployerJob } from "@/lib/services/employer-jobs";

export const metadata: Metadata = { title: "Edit job" };

function dateInput(value: Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export default async function EditEmployerJobPage({ params }: { params: Promise<{ id: string }> }) {
  const employer = await requireEmployer();
  const { id } = await params;
  const job = await findEmployerJob(employer, id);
  if (!job || job.status === "REJECTED") notFound();
  const options = await getEmployerJobFormOptions();
  const deadline = dateInput(job.applicationDeadline);
  const reopening = job.status === "CLOSED" || job.status === "EXPIRED";

  return (
    <>
      <PageTitle action={<JobStatusBadge status={job.status} />} title={job.title} />
      {reopening ? <div className="mb-6"><Notice tone="info">This job is {job.status === "CLOSED" ? "closed" : "expired"}. Choose a new last date and save to reopen it.</Notice></div> : null}
      {job.status === "PUBLISHED" && !employer.company.isVerified ? (
        <div className="mb-6"><Notice tone="warning">Saving changes takes this job off the site until JobDraftly approves the new version.</Notice></div>
      ) : null}
      <EmployerJobForm
        action={saveEmployerJobAction.bind(null, job.id)}
        categories={options.categories}
        defaults={{
          title: job.title,
          categoryId: job.categoryId,
          locationId: job.locationId,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          workplaceType: job.workplaceType,
          education: job.education ?? "",
          description: job.description,
          responsibilities: job.responsibilities ?? "",
          requirements: job.requirements ?? "",
          skills: job.skills ?? "",
          salaryMin: job.salaryMin?.toString() ?? "",
          salaryMax: job.salaryMax?.toString() ?? "",
          salaryVisibility: job.salaryVisibility,
          salaryPeriod: job.salaryPeriod ?? "MONTH",
          applicationDeadline: deadline && deadline >= options.minDate ? deadline : options.defaultDeadline,
          applicationMethod: job.applicationMethod === "EXTERNAL_URL" ? "EXTERNAL_URL" : "ON_SITE",
          applicationUrl: job.applicationUrl ?? "",
        }}
        goesLiveImmediately={employer.company.isVerified}
        maxDate={options.maxDate}
        minDate={options.minDate}
        provinces={options.provinces}
        submitLabel={reopening ? "Save and reopen" : "Save changes"}
      />
    </>
  );
}
