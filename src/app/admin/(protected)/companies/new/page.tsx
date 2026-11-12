import { Building2 } from "lucide-react";

import { createCompanyAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CompanyForm } from "@/components/admin/company-form";
import { db } from "@/lib/db";

export default async function NewCompanyPage() {
  const cities = await db.jobLocation.findMany({ where: { type: "CITY", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <><AdminPageHeader description="Add an employer profile. Verification remains an explicit administrator decision." icon={Building2} title="Add company" /><CompanyForm action={createCompanyAction} cities={cities} /></>;
}
