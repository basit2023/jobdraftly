"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  DatabaseZap,
  FolderTree,
  LogOut,
  MapPinned,
  Menu,
  Radar,
  Settings,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  ["/admin/dashboard", "Dashboard", BarChart3],
  ["/admin/jobs", "Jobs", BriefcaseBusiness],
  ["/admin/companies", "Companies", Building2],
  ["/admin/categories", "Categories", FolderTree],
  ["/admin/locations", "Locations", MapPinned],
  ["/admin/sources", "Sources", Tags],
  ["/admin/monitoring", "Monitoring", Radar],
  ["/admin/imports", "Review queue", DatabaseZap],
  ["/admin/settings", "Settings", Settings],
] as const;

export function AdminSidebar({
  admin,
}: {
  admin: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Open administrator navigation"
        className="fixed left-4 top-4 z-40 grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {open ? (
        <button
          aria-label="Close administrator navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col bg-[#07182d] text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link className="flex items-center gap-3" href="/admin/dashboard">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-500 text-white">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">JobDraftly</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                Administrator
              </span>
            </span>
          </Link>
          <button
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav aria-label="Administrator" className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigation.map(([href, label, Icon]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                href={href}
                key={href}
                onClick={() => setOpen(false)}
              >
                <Icon aria-hidden="true" className="size-4.5" />
                <span className="flex-1">{label}</span>
                {active ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/[0.06] p-3.5">
            <p className="truncate text-sm font-extrabold">{admin.name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{admin.email}</p>
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-300">
              {admin.role.replaceAll("_", " ")}
            </p>
          </div>
          <button
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
