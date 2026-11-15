import type { Metadata } from "next";

import { saveEmployerJobAction } from "@/app/employer/actions";
import { EmployerJobForm } from "@/components/employer/employer-job-form";
import { PageTitle } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { getEmployerJobFormOptions } from "@/lib/services/employer-form-options";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewEmployerJobPage() {
  const employer = await requireEmployer();
  const options = await getEmployerJobFormOptions();
  return (
    <>
      <PageTitle description={`Posting as ${employer.company.name}.`} title="Post a job" />
      <EmployerJobForm
        action={saveEmployerJobAction.bind(null, null)}
        categories={options.categories}
        defaults={{ applicationDeadline: options.defaultDeadline }}
        goesLiveImmediately={employer.company.isVerified}
        maxDate={options.maxDate}
        minDate={options.minDate}
        provinces={options.provinces}
        submitLabel={employer.company.isVerified ? "Publish job" : "Submit for approval"}
      />
    </>
  );
}
