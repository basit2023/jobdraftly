import type { Metadata } from "next";
import Link from "next/link";

import { updateCompanyProfileAction } from "@/app/employer/actions";
import { CompanyProfileForm } from "@/components/employer/company-profile-form";
import { Card, Notice, PageTitle } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { CONTACT_EMAIL } from "@/lib/site-contact";

export const metadata: Metadata = { title: "Company profile" };

export default async function EmployerCompanyPage() {
  const employer = await requireEmployer();
  const [company, cities] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: employer.companyId }, select: { name: true, slug: true, description: true, websiteUrl: true, industry: true, locationId: true, isVerified: true } }),
    db.jobLocation.findMany({ where: { isActive: true, type: "CITY" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageTitle
        action={company.isVerified ? <Link className="text-sm font-medium text-brand hover:underline" href={`/companies/${company.slug}`} target="_blank">View public page</Link> : null}
        description="This information appears on your public company page and with your jobs."
        title={company.name}
      />
      <div className="mb-6">
        {company.isVerified ? (
          <Notice tone="success">Verified employer — your jobs go live as soon as you post them.</Notice>
        ) : (
          <Notice tone="info">
            Not verified yet. Jobs are checked before going live. To get verified, email{" "}
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from your company email address.
          </Notice>
        )}
      </div>
      <Card>
        <CompanyProfileForm
          action={updateCompanyProfileAction}
          canEdit={employer.role === "OWNER"}
          cities={cities}
          defaults={{ description: company.description ?? "", websiteUrl: company.websiteUrl ?? "", industry: company.industry ?? "", locationId: company.locationId ?? "" }}
        />
      </Card>
      <p className="mt-4 text-xs text-muted">To change your company name or logo, email {CONTACT_EMAIL}.</p>
    </>
  );
}
