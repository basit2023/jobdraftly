"use client";

import { ArrowUpRight } from "lucide-react";

import { recordAnalyticsEvent } from "./client-events";

export function TrackedApplicationLink({
  href,
  jobId,
  slug,
  className = "",
}: {
  href: string;
  jobId: string;
  slug: string;
  className?: string;
}) {
  return (
    <a
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark ${className}`}
      href={href}
      onClick={() => recordAnalyticsEvent({ type: "APPLICATION_LINK_CLICK", jobId, path: `/jobs/${slug}` }, "application_link_click")}
      rel="nofollow noopener noreferrer"
      target="_blank"
    >
      Apply on employer&apos;s site
      <ArrowUpRight aria-hidden="true" className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
