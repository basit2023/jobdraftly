import "server-only";

import type { AdminRole } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import { authOptions } from "./options";

export async function getAuthorizedAdmin() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  // A company (employer) login must never pass an administrator check.
  if (!id || session.user.kind !== "admin") return null;

  return db.admin.findFirst({
    where: { id, isActive: true },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function requireAdmin(roles?: AdminRole[]) {
  const admin = await getAuthorizedAdmin();
  if (!admin || (roles && !roles.includes(admin.role))) {
    redirect("/admin/login");
  }
  return admin;
}
