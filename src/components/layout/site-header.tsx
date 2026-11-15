"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "./logo";

const navigation = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/jobs/government", label: "Government" },
  { href: "/jobs/remote", label: "Remote" },
  { href: "/jobs/internships", label: "Internships" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/jobs") {
    // "Jobs" covers search, city, category and detail pages, but not the
    // sections that have their own nav item.
    return (
      pathname.startsWith("/jobs") &&
      !navigation.some(
        (item) => item.href !== "/jobs" && pathname.startsWith(item.href),
      )
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Logo onClick={() => setOpen(false)} preload />

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-brand" : "text-body hover:text-ink"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            className="text-sm font-medium text-body transition-colors hover:text-ink"
            href="/about"
          >
            About
          </Link>
          <Link
            className="text-sm font-medium text-body transition-colors hover:text-ink"
            href="/employer/login"
          >
            Employer sign in
          </Link>
          <Link
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand"
            href="/contact?topic=employer"
          >
            Post a job
          </Link>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-md text-ink hover:bg-paper lg:hidden"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-line bg-white px-4 pb-5 pt-2 lg:hidden"
          id="mobile-navigation"
        >
          <ul className="mx-auto max-w-7xl divide-y divide-line">
            {[...navigation, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/employer/login", label: "Employer sign in" }].map(
              (item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`block py-3 text-[15px] font-medium ${active ? "text-brand" : "text-ink"}`}
                      href={item.href}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
          <Link
            className="mt-4 block rounded-md bg-ink px-4 py-3 text-center text-sm font-medium text-white"
            href="/contact?topic=employer"
            onClick={() => setOpen(false)}
          >
            Post a job
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
