import type { AdminRole, EmployerRole } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

/** "admin" = JobDraftly staff (/admin). "employer" = a company's user (/employer). */
type AccountKind = "admin" | "employer";

declare module "next-auth" {
  interface User {
    kind: AccountKind;
    role: AdminRole | EmployerRole;
    companyId?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      kind: AccountKind;
      role: AdminRole | EmployerRole;
      companyId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    kind?: AccountKind;
    role?: AdminRole | EmployerRole;
    companyId?: string;
  }
}
