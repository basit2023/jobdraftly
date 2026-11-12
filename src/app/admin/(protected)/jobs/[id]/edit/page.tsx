import { PencilLine } from "lucide-react";
import { notFound } from "next/navigation";

import { updateJobAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { JobForm } from "@/components/admin/job-form";
import { db } from "@/lib/db";
import { getJobFormOptions, toDateTimeLocal } from "@/lib/services/admin-data";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, options] = await Promise.all([db.job.findUnique({ where: { id } }), getJobFormOptions()]);
  if (!job) notFound();
  const action = updateJobAction.bind(null, id);
  const defaults = { ...job, salaryMin: job.salaryMin?.toString() ?? "", salaryMax: job.salaryMax?.toString() ?? "", applicationDeadline: toDateTimeLocal(job.applicationDeadline), expiresAt: toDateTimeLocal(job.expiresAt) };
  return <><AdminPageHeader description="Review every public field, source detail, and application destination before saving." icon={PencilLine} title={`Edit: ${job.title}`} /><JobForm action={action} defaults={defaults} imported={Boolean(job.jobImportId)} {...options} /></>;
}
