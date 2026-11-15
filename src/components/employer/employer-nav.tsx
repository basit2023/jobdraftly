"use client";

import { BarChart3, BriefcaseBusiness, Building2, LogOut, Menu, Plus, Users, UserRoundSearch, X } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/layout/logo";

type Props = {
  companyName: string;
  userName: string;
  isOwner: boolean;
  isVerified: boolean;
  newApplicants: number;
};

export function EmployerNav({ companyName, userName, isOwner, isVerified, newApplicants }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/employer/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/employer/jobs", label: "Jobs", icon: BriefcaseBusiness },
    { href: "/employer/applications", label: "Applicants", icon: UserRoundSearch, badge: newApplicants },
    { href: "/employer/company", label: "Company profile", icon: Building2 },
    ...(isOwner ? [{ href: "/employer/team", label: "Team", icon: Users }] : []),
  ];

  const nav = (
    <nav aria-label="Employer" className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-4">
        <Link aria-label="JobDraftly home" href="/">
          <Logo />
        </Link>
        <p className="mt-3 truncate text-sm font-semibold text-ink" title={companyName}>{companyName}</p>
        <p className="text-xs text-muted">{isVerified ? "Verified employer" : "Jobs are checked before going live"}</p>
      </div>
      <div className="px-3 pt-4">
        <Link
          className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white hover:bg-brand"
          href="/employer/jobs/new"
          onClick={() => setOpen(false)}
        >
          <Plus aria-hidden="true" className="size-4" /> Post a job
        </Link>
      </div>
      <ul className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm ${active ? "bg-paper font-semibold text-ink" : "text-body hover:bg-paper hover:text-ink"}`}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                <item.icon aria-hidden="true" className="size-4" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line px-5 py-4">
        <p className="truncate text-sm text-ink">{userName}</p>
        <button
          className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={() => void signOut({ callbackUrl: "/employer/login" })}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Link aria-label="JobDraftly home" href="/">
          <Logo />
        </Link>
        <button aria-expanded={open} aria-label="Open menu" className="grid size-10 place-items-center rounded-md border border-line" onClick={() => setOpen(true)} type="button">
          <Menu aria-hidden="true" className="size-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} type="button" />
          <div className="absolute inset-y-0 left-0 w-72 bg-white">
            <button aria-label="Close menu" className="absolute right-3 top-3 grid size-9 place-items-center rounded-md" onClick={() => setOpen(false)} type="button">
              <X aria-hidden="true" className="size-5" />
            </button>
            {nav}
          </div>
        </div>
      ) : null}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">{nav}</aside>
    </>
  );
}
