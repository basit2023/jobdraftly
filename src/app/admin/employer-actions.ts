"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/services/admin-audit";
import { createEmployerUser, describeDelivery, emailSetupLink, EmployerAccountError, issueSetupLink } from "@/lib/services/employer-accounts";
import type { FormState } from "@/lib/validations/employer";

/** Administrators create the company's first login (normally the owner) and get a one-time setup link. */
export async function createCompanyLoginAction(companyId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, isActive: true } });
  if (!company) return { success: false, message: "Company not found." };
  if (!company.isActive) return { success: false, message: "Reactivate this company before giving it a login." };
  const role = formData.get("role") === "RECRUITER" ? "RECRUITER" : "OWNER";
  try {
    const { user, link } = await createEmployerUser({
      companyId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role,
    });
    const delivery = describeDelivery(await emailSetupLink(user.id, link, "welcome"), user.email, link.url);
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "EmployerUser", entityId: user.id, summary: `Created ${role.toLowerCase()} login ${user.email} for ${company.name}` });
    revalidatePath(`/admin/companies/${companyId}/edit`);
    revalidatePath("/admin/companies");
    return { success: true, message: delivery.message, link: delivery.link };
  } catch (error) {
    if (error instanceof EmployerAccountError) return { success: false, message: error.message };
    if (error && typeof error === "object" && "issues" in error) return { success: false, message: "Enter a name and a valid email address." };
    console.error(error);
    return { success: false, message: "The login could not be created." };
  }
}

export async function adminSetupLinkAction(userId: string): Promise<FormState> {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const user = await db.employerUser.findUnique({ where: { id: userId }, select: { id: true, email: true, isActive: true, companyId: true, passwordHash: true } });
  if (!user || !user.isActive) return { success: false, message: "Switch this login on first." };
  const link = await issueSetupLink(user.id);
  // Not verified yet → resend the welcome email; already set up → a password reset email.
  const delivery = describeDelivery(await emailSetupLink(user.id, link, user.passwordHash ? "reset" : "welcome"), user.email, link.url);
  await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: "EmployerUser", entityId: user.id, summary: `Sent a ${user.passwordHash ? "password reset" : "verification"} link to ${user.email}` });
  revalidatePath(`/admin/companies/${user.companyId}/edit`);
  return { success: true, message: `${delivery.message} Any earlier link no longer works.`, link: delivery.link };
}

export async function adminSetEmployerActiveAction(userId: string, active: boolean) {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const user = await db.employerUser.update({
    where: { id: userId },
    data: { isActive: active, ...(active ? {} : { setupTokenHash: null, setupTokenExpiresAt: null }) },
    select: { email: true, companyId: true },
  });
  await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: "EmployerUser", entityId: userId, summary: `${active ? "Switched on" : "Switched off"} employer login ${user.email}` });
  revalidatePath(`/admin/companies/${user.companyId}/edit`);
}
