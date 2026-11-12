import Link from "next/link";

import type { PublicJobCard } from "@/lib/services/public-jobs";
import {
  employmentTypeLabel,
  formatRelativeDate,
  formatSalary,
  workplaceTypeLabel,
} from "@/lib/formatters";

import { CompanyLogo } from "../companies/company-logo";

export function JobCard({ job }: { job: PublicJobCard }) {
  const salary = formatSalary(job);
  const meta = [
    job.location.name,
    workplaceTypeLabel(job.workplaceType),
    employmentTypeLabel(job.employmentType),
  ];

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-line bg-white p-5 transition-colors hover:border-ink/25">
      <div className="flex items-start gap-4">
        <CompanyLogo logoUrl={job.company.logoUrl} name={job.company.name} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-ink">
            {/* The title link covers the whole card so the card is one click target. */}
            <Link
              className="after:absolute after:inset-0 after:rounded-lg group-hover:text-brand"
              href={`/jobs/${job.slug}`}
            >
              {job.title}
            </Link>
          </h3>
          <Link
            className="relative z-10 mt-0.5 inline-block text-sm text-body hover:text-ink hover:underline"
            href={`/companies/${job.company.slug}`}
          >
            {job.company.name}
          </Link>
        </div>
        {job.isFeatured ? (
          <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Featured
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-body">
        {meta.map((item, index) => (
          <span key={index}>
            {index ? <span aria-hidden="true" className="mx-1.5 text-line">|</span> : null}
            {item}
          </span>
        ))}
      </p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="text-sm font-medium text-ink">{salary ?? <span className="font-normal text-muted">Salary not listed</span>}</p>
        <p className="shrink-0 text-xs text-muted">{formatRelativeDate(job.publishedAt)}</p>
      </div>
    </article>
  );
}
