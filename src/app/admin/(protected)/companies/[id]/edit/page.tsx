import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";

import { updateCompanyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CompanyForm } from "@/components/admin/company-form";
import { CompanyLogins } from "@/components/admin/company-logins";
import { db } from "@/lib/db";

/** Shown once after "Add company" created an owner login. */
const loginNotices: Record<string, { tone: string; text: string }> = {
  emailed: {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    text: "Company created. We emailed the owner a link to verify their email address and choose a password. It works once and expires in 72 hours.",
  },
  saved: {
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    text: "Company created. Email sending isn't set up on this computer, so the verification email was saved in storage/dev-outbox instead of being sent. Use “Resend verification email” below to get a link you can open.",
  },
  failed: {
    tone: "border-red-200 bg-red-50 text-red-900",
    text: "Company and owner login created, but the verification email could not be sent (check the SMTP settings). Use “Resend verification email” below to get a link and send it yourself.",
  },
};

export default async function EditCompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ login?: string }> }) {
  const { id } = await params;
  const { login } = await searchParams;
  const [company, cities] = await Promise.all([
    db.company.findUnique({ where: { id } }),
    db.jobLocation.findMany({ where: { type: "CITY", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!company) notFound();
  const notice = login ? loginNotices[login] : undefined;

  return (
    <>
      <AdminPageHeader description="Update public company details, branding, location, and verification." icon={Building2} title={`Edit: ${company.name}`} />
      {notice ? <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold leading-6 ${notice.tone}`} role="status">{notice.text}</div> : null}
      <CompanyForm action={updateCompanyAction.bind(null, id)} cities={cities} defaults={company} />
      <CompanyLogins companyId={company.id} companyName={company.name} isVerified={company.isVerified} />
    </>
  );
}
