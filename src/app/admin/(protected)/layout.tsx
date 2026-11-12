import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/auth/session";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <AdminSidebar admin={admin} />
      <main className="min-h-screen px-4 pb-12 pt-20 sm:px-7 lg:ml-[286px] lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
