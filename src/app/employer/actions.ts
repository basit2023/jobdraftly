"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { revalidatePublicJobDiscovery } from "@/lib/seo/revalidate";
import { ApplicationError, saveApplicationNotes, updateApplicationStatus } from "@/lib/services/applications";
import {
  completeEmployerSetup,
  createEmployerUser,
  describeDelivery,
  emailSetupLink,
  EmployerAccountError,
  employerPasswordSchema,
  issueSetupLink,
} from "@/lib/services/employer-accounts";
import { closeEmployerJob, createEmployerJob, EmployerJobError, updateEmployerJob } from "@/lib/services/employer-jobs";
import {
  applicationStatuses,
  companyProfileSchema,
  employerJobSchema,
  type FormState,
} from "@/lib/validations/employer";

function fieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): FormState {
  return { success: false, message: "Please fix the highlighted fields.", errors: error.flatten().fieldErrors };
}

function knownError(error: unknown): FormState {
  if (error instanceof EmployerJobError || error instanceof EmployerAccountError || error instanceof ApplicationError) {
    return { success: false, message: error.message };
  }
  console.error(error);
  return { success: false, message: "Something went wrong. Nothing was changed — please try again." };
}

/* ---------------------------- Account setup ---------------------------- */

export async function completeSetupAction(token: string, _state: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const parsed = employerPasswordSchema.safeParse(password);
  if (!parsed.success) return { success: false, message: "Choose a stronger password.", errors: { password: parsed.error.issues.map((issue) => issue.message) } };
  if (password !== confirm) return { success: false, message: "The passwords don't match.", errors: { confirmPassword: ["The passwords don't match"] } };
  try {
    await completeEmployerSetup(token, password);
  } catch (error) {
    return knownError(error);
  }
  redirect("/employer/login?setup=done");
}

/* --------------------------------- Jobs -------------------------------- */

export async function saveEmployerJobAction(jobId: string | null, _state: FormState, formData: FormData): Promise<FormState> {
  const employer = await requireEmployer();
  const parsed = employerJobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error);
  let status: string;
  try {
    const job = jobId ? await updateEmployerJob(employer, jobId, parsed.data) : await createEmployerJob(employer, parsed.data);
    status = job.status;
  } catch (error) {
    return knownError(error);
  }
  revalidatePath("/employer", "layout");
  revalidatePublicJobDiscovery();
  redirect(`/employer/jobs?saved=${status === "PUBLISHED" ? "live" : "review"}`);
}

export async function closeEmployerJobAction(jobId: string) {
  const employer = await requireEmployer();
  await closeEmployerJob(employer, jobId);
  revalidatePath("/employer", "layout");
  revalidatePublicJobDiscovery();
}

/* ----------------------------- Applications ---------------------------- */

export async function updateApplicationStatusAction(applicationId: string, formData: FormData) {
  const employer = await requireEmployer();
  const status = String(formData.get("status") ?? "");
  if (!(applicationStatuses as readonly string[]).includes(status)) throw new Error("Unknown status.");
  await updateApplicationStatus(employer, applicationId, status as (typeof applicationStatuses)[number]);
  revalidatePath("/employer", "layout");
}

export async function saveApplicationNotesAction(applicationId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const employer = await requireEmployer();
  try {
    await saveApplicationNotes(employer, applicationId, String(formData.get("notes") ?? ""));
  } catch (error) {
    return knownError(error);
  }
  revalidatePath(`/employer/applications/${applicationId}`);
  return { success: true, message: "Notes saved. Only your team can see them." };
}

/* ---------------------------- Company profile -------------------------- */

export async function updateCompanyProfileAction(_state: FormState, formData: FormData): Promise<FormState> {
  const employer = await requireEmployer(["OWNER"]);
  const parsed = companyProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (parsed.data.locationId && !(await db.jobLocation.findFirst({ where: { id: parsed.data.locationId, isActive: true }, select: { id: true } }))) {
    return { success: false, message: "Choose a city from the list." };
  }
  await db.company.update({ where: { id: employer.companyId }, data: parsed.data });
  revalidatePath("/employer", "layout");
  revalidatePath(`/companies/${employer.company.slug}`);
  return { success: true, message: "Company profile saved." };
}

/* --------------------------------- Team -------------------------------- */

export async function addTeamMemberAction(_state: FormState, formData: FormData): Promise<FormState> {
  const employer = await requireEmployer(["OWNER"]);
  try {
    const { user, link } = await createEmployerUser({
      companyId: employer.companyId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: "RECRUITER",
    });
    const delivery = describeDelivery(await emailSetupLink(user.id, link, "welcome", employer.name), user.email, link.url);
    revalidatePath("/employer/team");
    return { success: true, message: `Team member added. ${delivery.message}`, link: delivery.link };
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return { success: false, message: "Enter a name and a valid email address." };
    return knownError(error);
  }
}

async function teamMember(companyId: string, memberId: string) {
  return db.employerUser.findFirst({ where: { id: memberId, companyId }, select: { id: true, role: true } });
}

export async function resetTeamMemberLinkAction(memberId: string): Promise<FormState> {
  const employer = await requireEmployer(["OWNER"]);
  const member = await db.employerUser.findFirst({ where: { id: memberId, companyId: employer.companyId }, select: { id: true, email: true, passwordHash: true } });
  if (!member) return { success: false, message: "Team member not found." };
  const link = await issueSetupLink(member.id);
  const delivery = describeDelivery(await emailSetupLink(member.id, link, member.passwordHash ? "reset" : "welcome", employer.name), member.email, link.url);
  revalidatePath("/employer/team");
  return { success: true, message: `${delivery.message} Any earlier link no longer works.`, link: delivery.link };
}

export async function setTeamMemberActiveAction(memberId: string, active: boolean) {
  const employer = await requireEmployer(["OWNER"]);
  if (memberId === employer.userId) throw new Error("You can't deactivate your own login.");
  const member = await teamMember(employer.companyId, memberId);
  if (!member) throw new Error("Team member not found.");
  await db.employerUser.update({ where: { id: member.id }, data: { isActive: active, ...(active ? {} : { setupTokenHash: null, setupTokenExpiresAt: null }) } });
  revalidatePath("/employer/team");
}
