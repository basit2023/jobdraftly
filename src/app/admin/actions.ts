"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/services/admin-audit";
import { createEntitySlug } from "@/lib/services/entity-slug";
import { createJobDeduplicationKey, createJobSlug, createSourceUrlHash } from "@/lib/services/job-identity";
import { revalidatePublicJobDiscovery } from "@/lib/seo/revalidate";
import {
  type AdminFormState,
  categoryAdminSchema,
  companyAdminSchema,
  jobAdminSchema,
  locationAdminSchema,
  sourceAdminSchema,
} from "@/lib/validations/admin-forms";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): AdminFormState {
  return { success: false, message: "Review the highlighted fields.", errors: error.flatten().fieldErrors };
}

function failure(error: unknown): AdminFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { success: false, message: "A record with the same unique details already exists." };
  }
  console.error(error);
  return { success: false, message: "The operation could not be completed. No further changes were made." };
}

function isTrustedHttpUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function uniqueCompanySlug(name: string, currentId?: string) {
  const base = createEntitySlug(name);
  let slug = base;
  let counter = 2;
  while (await db.company.findFirst({ where: { slug, ...(currentId ? { id: { not: currentId } } : {}) }, select: { id: true } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

async function uniqueTaxonomySlug(kind: "category" | "location" | "source", name: string) {
  const base = createEntitySlug(name);
  let slug = base;
  let counter = 2;
  const exists = async (candidate: string) => {
    if (kind === "category") return db.jobCategory.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (kind === "location") return db.jobLocation.findUnique({ where: { slug: candidate }, select: { id: true } });
    return db.jobSource.findUnique({ where: { slug: candidate }, select: { id: true } });
  };
  while (await exists(slug)) slug = `${base}-${counter++}`;
  return slug;
}

export async function createJobAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = jobAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const data = parsed.data;
    const company = await db.company.findUnique({ where: { id: data.companyId }, select: { slug: true } });
    if (!company) return { success: false, message: "The selected company no longer exists." };

    const deduplicationKey = createJobDeduplicationKey({
      title: data.title,
      companyId: data.companyId,
      locationId: data.locationId,
      sourceId: data.sourceId,
      sourceUrl: data.sourceUrl,
      applicationUrl: data.applicationUrl,
      applicationDeadline: data.applicationDeadline,
    });
    const job = await db.job.create({
      data: {
        ...data,
        slug: createJobSlug(data.title, company.slug),
        sourceUrlHash: createSourceUrlHash(data.sourceUrl),
        deduplicationKey,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
    });
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "Job", entityId: job.id, summary: `Created job: ${job.title}`, metadata: { status: job.status } });
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/admin/jobs");
  revalidatePublicJobDiscovery();
  redirect("/admin/jobs?created=1");
}

export async function updateJobAction(id: string, _state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = jobAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);

  let previousSlug: string | null = null;
  let currentSlug: string | null = null;
  try {
    const existing = await db.job.findUnique({ where: { id }, include: { company: { select: { slug: true } }, source: { select: { permissionStatus: true } } } });
    if (!existing) return { success: false, message: "This job no longer exists." };
    const data = parsed.data;
    const [selectedCompany, selectedSource] = await Promise.all([
      db.company.findUnique({ where: { id: data.companyId }, select: { slug: true } }),
      data.sourceId ? db.jobSource.findUnique({ where: { id: data.sourceId }, select: { permissionStatus: true } }) : null,
    ]);
    if (!selectedCompany) return { success: false, message: "The selected company no longer exists." };
    if (existing.jobImportId && data.status === "PUBLISHED" && existing.verificationStatus !== "VERIFIED") {
      return { success: false, message: "Approve and verify this imported vacancy before publication." };
    }
    if (existing.jobImportId && data.status === "PUBLISHED" && selectedSource?.permissionStatus !== "APPROVED") {
      return { success: false, message: "The source permission must remain approved before publication." };
    }
    const deduplicationKey = createJobDeduplicationKey({
      title: data.title,
      companyId: data.companyId,
      locationId: data.locationId,
      sourceId: data.sourceId,
      sourceExternalId: existing.sourceExternalId,
      sourceUrl: data.sourceUrl,
      applicationUrl: data.applicationUrl,
      applicationDeadline: data.applicationDeadline,
    });
    const slugChanged = existing.title !== data.title || existing.companyId !== data.companyId;
    currentSlug = slugChanged ? createJobSlug(data.title, selectedCompany.slug) : existing.slug;
    previousSlug = slugChanged ? existing.slug : null;
    const job = await db.$transaction(async (transaction) => {
      if (slugChanged) {
        await transaction.jobSlugRedirect.deleteMany({ where: { oldSlug: currentSlug! } });
        await transaction.jobSlugRedirect.upsert({ where: { oldSlug: existing.slug }, update: { jobId: id }, create: { oldSlug: existing.slug, jobId: id } });
      }
      return transaction.job.update({
        where: { id },
        data: {
          ...data,
          slug: currentSlug!,
          sourceUrlHash: createSourceUrlHash(data.sourceUrl),
          deduplicationKey,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          publishedAt: data.status === "PUBLISHED" ? existing.publishedAt ?? new Date() : existing.publishedAt,
        },
      });
    });
    await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: "Job", entityId: job.id, summary: `Updated job: ${job.title}`, metadata: { status: job.status } });
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${id}/edit`);
  if (previousSlug) revalidatePath(`/jobs/${previousSlug}`);
  if (currentSlug) revalidatePath(`/jobs/${currentSlug}`);
  revalidatePublicJobDiscovery();
  redirect("/admin/jobs?updated=1");
}

export async function archiveJobAction(id: string) {
  const admin = await requireAdmin();
  const job = await db.job.update({ where: { id }, data: { status: "CLOSED", isFeatured: false } });
  await createAuditLog({ adminId: admin.id, action: "ARCHIVE", entityType: "Job", entityId: id, summary: `Archived job: ${job.title}` });
  revalidatePath("/admin/jobs");
  revalidatePath(`/jobs/${job.slug}`);
  revalidatePublicJobDiscovery();
}

export async function setJobPublishedAction(id: string, publish: boolean) {
  const admin = await requireAdmin();
  const existing = await db.job.findUnique({ where: { id }, include: { source: { select: { permissionStatus: true } } } });
  if (!existing) return;
  if (publish && existing.applicationMethod === "EXTERNAL_URL" && !isTrustedHttpUrl(existing.applicationUrl)) {
    throw new Error("A verified application URL is required before publication.");
  }
  if (publish && existing.jobImportId && existing.verificationStatus !== "VERIFIED") {
    throw new Error("Approve and verify this imported vacancy before publication.");
  }
  if (publish && existing.jobImportId && existing.source?.permissionStatus !== "APPROVED") {
    throw new Error("The source permission must remain approved before publication.");
  }
  const job = await db.job.update({
    where: { id },
    data: publish
      ? { status: "PUBLISHED", publishedAt: existing.publishedAt ?? new Date() }
      : { status: "DRAFT", isFeatured: false },
  });
  await createAuditLog({ adminId: admin.id, action: publish ? "PUBLISH" : "UNPUBLISH", entityType: "Job", entityId: id, summary: `${publish ? "Published" : "Unpublished"} job: ${job.title}` });
  revalidatePath("/admin/jobs");
  revalidatePath(`/jobs/${job.slug}`);
  revalidatePublicJobDiscovery();
}

export async function setJobFeaturedAction(id: string, featured: boolean) {
  const admin = await requireAdmin();
  const existing = await db.job.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return;
  if (featured && existing.status !== "PUBLISHED") {
    throw new Error("Only published jobs can be featured.");
  }
  const job = await db.job.update({ where: { id }, data: { isFeatured: featured } });
  await createAuditLog({ adminId: admin.id, action: featured ? "FEATURE" : "UNFEATURE", entityType: "Job", entityId: id, summary: `${featured ? "Featured" : "Unfeatured"} job: ${job.title}` });
  revalidatePath("/admin/jobs");
  revalidatePath("/");
}

export async function createCompanyAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = companyAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const slug = await uniqueCompanySlug(parsed.data.name);
    const company = await db.company.create({ data: { ...parsed.data, slug } });
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "Company", entityId: company.id, summary: `Created company: ${company.name}` });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/companies");
  redirect("/admin/companies?created=1");
}

export async function updateCompanyAction(id: string, _state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = companyAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const company = await db.company.update({ where: { id }, data: parsed.data });
    await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: "Company", entityId: company.id, summary: `Updated company: ${company.name}` });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${id}/edit`);
  revalidatePath("/companies");
  redirect("/admin/companies?updated=1");
}

export async function archiveCompanyAction(id: string) {
  const admin = await requireAdmin();
  const company = await db.company.update({ where: { id }, data: { isActive: false, isVerified: false } });
  await createAuditLog({ adminId: admin.id, action: "ARCHIVE", entityType: "Company", entityId: id, summary: `Archived company: ${company.name}` });
  revalidatePath("/admin/companies");
  revalidatePath("/companies");
}

export async function createCategoryAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = categoryAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const slug = await uniqueTaxonomySlug("category", parsed.data.name);
    const category = await db.jobCategory.create({ data: { ...parsed.data, slug, isActive: true } });
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "JobCategory", entityId: category.id, summary: `Created category: ${category.name}` });
  } catch (error) { return failure(error); }
  revalidatePath("/admin/categories");
  return { success: true, message: "Category created." };
}

export async function createLocationAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = locationAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const slug = await uniqueTaxonomySlug("location", parsed.data.name);
    const location = await db.jobLocation.create({ data: { ...parsed.data, provinceId: parsed.data.type === "PROVINCE" ? null : parsed.data.provinceId, slug, isActive: true } });
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "JobLocation", entityId: location.id, summary: `Created location: ${location.name}` });
  } catch (error) { return failure(error); }
  revalidatePath("/admin/locations");
  return { success: true, message: "Location created." };
}

export async function createSourceAction(_state: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const parsed = sourceAdminSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const slug = await uniqueTaxonomySlug("source", parsed.data.name);
    const source = await db.jobSource.create({ data: { ...parsed.data, slug, isActive: true } });
    await createAuditLog({ adminId: admin.id, action: "CREATE", entityType: "JobSource", entityId: source.id, summary: `Created source: ${source.name}` });
  } catch (error) { return failure(error); }
  revalidatePath("/admin/sources");
  return { success: true, message: "Source created." };
}

export async function setSourcePermissionAction(id: string, approve: boolean) {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const source = await db.jobSource.findUnique({ where: { id } });
  if (!source) throw new Error("Source not found.");
  if (approve && source.type !== "MANUAL" && (!source.termsUrl || !source.permissionNotes)) {
    throw new Error("Document the source terms URL and permission evidence before approval.");
  }
  await db.jobSource.update({ where: { id }, data: { permissionStatus: approve ? "APPROVED" : "REVOKED", approvedAt: approve ? new Date() : null, isActive: approve ? source.isActive : false, ...(!approve ? { monitoringEnabled: false, nextScanAt: null, monitorLeaseUntil: null } : {}) } });
  await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: "JobSource", entityId: id, summary: `${approve ? "Approved" : "Revoked"} import permission for ${source.name}` });
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports/new");
}

export async function toggleTaxonomyAction(kind: "category" | "location" | "source", id: string, active: boolean) {
  const admin = kind === "source"
    ? await requireAdmin(["SUPER_ADMIN", "ADMIN"])
    : await requireAdmin();
  const result = kind === "category"
    ? await db.jobCategory.update({ where: { id }, data: { isActive: active } })
    : kind === "location"
      ? await db.jobLocation.update({ where: { id }, data: { isActive: active } })
      : await db.jobSource.update({ where: { id }, data: { isActive: active, ...(!active ? { monitoringEnabled: false, nextScanAt: null, monitorLeaseUntil: null } : {}) } });
  await createAuditLog({ adminId: admin.id, action: "UPDATE", entityType: kind, entityId: id, summary: `${active ? "Activated" : "Deactivated"} ${kind}: ${result.name}` });
  revalidatePath(`/admin/${kind === "category" ? "categories" : `${kind}s`}`);
}
