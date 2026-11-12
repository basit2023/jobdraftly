import { BriefcaseBusiness } from "lucide-react";

import { createJobAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { JobForm } from "@/components/admin/job-form";
import { getJobFormOptions } from "@/lib/services/admin-data";

export default async function NewJobPage() {
  const options = await getJobFormOptions();
  return <><AdminPageHeader description="Create a reviewed manual vacancy with a verified application destination." icon={BriefcaseBusiness} title="Create job" /><JobForm action={createJobAction} {...options} /></>;
}
