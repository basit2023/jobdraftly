import Link from "next/link";

import { Logo } from "./logo";
import { CONTACT_EMAIL } from "@/lib/site-contact";

const columns = [
  {
    title: "Find work",
    links: [
      ["All jobs", "/jobs"],
      ["Government jobs", "/jobs/government"],
      ["Remote jobs", "/jobs/remote"],
      ["Internships", "/jobs/internships"],
    ],
  },
  {
    title: "Explore",
    links: [
      ["Companies", "/companies"],
      ["Job search tips", "/#tips"],
      ["Post a job", "/contact?topic=employer"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Privacy policy", "/privacy-policy"],
      ["Terms of use", "/terms"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-6">
              Job listings from across Pakistan, with a direct link to apply on the
              employer&apos;s own site.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-sm font-semibold text-white">{column.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map(([label, href]) => (
                    <li key={href}>
                      <Link className="text-sm transition-colors hover:text-white" href={href}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} JobDraftly ·{" "}
            <a className="hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>We never charge job seekers to apply.</p>
        </div>
      </div>
    </footer>
  );
}
