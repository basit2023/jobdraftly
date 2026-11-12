import "server-only";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/services/admin-audit";

export async function expireDueJobs(now = new Date()) {
  const pakistanDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const pakistanDayStart = new Date(`${pakistanDate}T00:00:00+05:00`);
  const due = await db.job.findMany({
    where: { status: "PUBLISHED", OR: [{ expiresAt: { lte: now } }, { applicationDeadline: { lt: pakistanDayStart } }] },
    select: { id: true },
    take: 1_000,
  });
  if (!due.length) return 0;
  const ids = due.map(({ id }) => id);
  const result = await db.job.updateMany({ where: { id: { in: ids }, status: "PUBLISHED" }, data: { status: "EXPIRED", isFeatured: false } });
  await createAuditLog({ action: "EXPIRE", entityType: "Job", summary: `Scheduled expiration closed ${result.count} vacancies`, metadata: { count: result.count, evaluatedAt: now.toISOString() } });
  return result.count;
}

