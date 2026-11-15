import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { CONTACT_EMAIL } from "@/lib/site-contact";

/** Plain centred card used by the employer login and setup pages. */
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <Link aria-label="JobDraftly home" className="mb-8" href="/">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">For employers</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-body">{description}</p>
        {children}
      </div>
      <p className="mt-6 max-w-md text-center text-xs leading-5 text-muted">
        Want to post jobs on JobDraftly? Email{" "}
        <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>{" "}
        and we&apos;ll set up your company account.
      </p>
    </main>
  );
}
