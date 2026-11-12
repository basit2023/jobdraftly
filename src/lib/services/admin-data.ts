import "server-only";

import { db } from "@/lib/db";

export async function getJobFormOptions() {
  const [companies, categories, locations, sources] = await Promise.all([
    db.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.jobCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.jobLocation.findMany({ where: { isActive: true, type: "CITY" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.jobSource.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { companies, categories, locations, sources };
}

export function toDateTimeLocal(value: Date | null): string {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
