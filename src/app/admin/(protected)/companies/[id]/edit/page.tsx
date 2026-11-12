import { Building2 } from "lucide-react";
import { notFound } from "next/navigation";

import { updateCompanyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CompanyForm } from "@/components/admin/company-form";
import { db } from "@/lib/db";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [company, cities] = await Promise.all([
    db.company.findUnique({ where: { id } }),
    db.jobLocation.findMany({ where: { type: "CITY", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!company) notFound();
  return <><AdminPageHeader description="Update public company details, branding, location, and verification." icon={Building2} title={`Edit: ${company.name}`} /><CompanyForm action={updateCompanyAction.bind(null, id)} cities={cities} defaults={company} /></>;
}
