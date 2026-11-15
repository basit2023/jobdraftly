import "server-only";

import { db } from "@/lib/db";
import { MAX_EMPLOYER_LISTING_DAYS } from "@/lib/validations/employer";

function pakistanDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

/** Categories and cities (grouped by province) for the employer job form, plus the allowed deadline range. */
export async function getEmployerJobFormOptions(now = new Date()) {
  const [categories, provinces] = await Promise.all([
    db.jobCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.jobLocation.findMany({
      where: { isActive: true, type: "PROVINCE" },
      orderBy: [{ sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        cities: { where: { isActive: true, type: "CITY" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
      },
    }),
  ]);
  return {
    categories,
    provinces,
    minDate: pakistanDate(now),
    maxDate: pakistanDate(new Date(now.getTime() + MAX_EMPLOYER_LISTING_DAYS * 86_400_000)),
    defaultDeadline: pakistanDate(new Date(now.getTime() + 30 * 86_400_000)),
  };
}
