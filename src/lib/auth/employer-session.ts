import "server-only";

import type { EmployerRole } from "@/generated/prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

import { authOptions } from "./options";

/** Everything employer code needs to scope its queries. Always taken from the session, never from input. */
export type EmployerContext = {
  userId: string;
  companyId: string;
  role: EmployerRole;
  name: string;
  email: string;
  company: { id: string; name: string; slug: string; isVerified: boolean; logoUrl: string | null };
};

/**
 * The signed-in company user, re-checked against the database on every request so
 * deactivating a person or archiving a company takes effect immediately.
 */
export async function getAuthorizedEmployer(): Promise<EmployerContext | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.kind !== "employer" || !session.user.id) return null;

  const user = await db.employerUser.findFirst({
    where: { id: session.user.id, isActive: true, passwordHash: { not: null }, company: { isActive: true } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: { select: { id: true, name: true, slug: true, isVerified: true, logoUrl: true } },
    },
  });
  if (!user) return null;
  return { userId: user.id, companyId: user.company.id, role: user.role, name: user.name, email: user.email, company: user.company };
}

export async function requireEmployer(roles?: EmployerRole[]) {
  const employer = await getAuthorizedEmployer();
  if (!employer) redirect("/employer/login");
  if (roles && !roles.includes(employer.role)) redirect("/employer/dashboard");
  return employer;
}
