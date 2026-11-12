import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export async function createAuditLog(input: {
  adminId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return db.auditLog.create({ data: input });
}
