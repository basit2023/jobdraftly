import { EmployerNav } from "@/components/employer/employer-nav";
import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmployerPortalLayout({ children }: { children: React.ReactNode }) {
  const employer = await requireEmployer();
  const newApplicants = await db.jobApplication.count({ where: { companyId: employer.companyId, viewedAt: null } });

  return (
    <div className="min-h-screen bg-paper">
      <EmployerNav
        companyName={employer.company.name}
        isOwner={employer.role === "OWNER"}
        isVerified={employer.company.isVerified}
        newApplicants={newApplicants}
        userName={employer.name}
      />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
