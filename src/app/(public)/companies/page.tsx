import type { Metadata } from "next";
import Form from "next/form";
import { Search } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/companies/company-logo";
import { PageHero } from "@/components/layout/page-hero";
import { Container } from "@/components/ui/container";
import { getPublicCompanies } from "@/lib/services/public-jobs";
import { hasSearchParams, pageMetadata } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const query = await searchParams;
  return pageMetadata({ title: "Companies Hiring in Pakistan", description: "Browse companies and government departments hiring in Pakistan, see their current job openings and apply directly on each employer's site.", path: "/companies", index: !hasSearchParams(query) });
}

type SearchParams = Promise<{ q?: string | string[] }>;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";
  const companies = await getPublicCompanies(query);

  return (
    <>
      <PageHero
        description="Browse employers with jobs listed on JobDraftly and see what each one is hiring for."
        title="Companies hiring in Pakistan"
      >
        <Form
          action="/companies"
          className="mt-6 flex max-w-xl gap-2 rounded-lg border border-line bg-white p-1.5"
          role="search"
        >
          <label className="relative flex-1">
            <span className="sr-only">Search companies</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              className="min-h-11 w-full rounded-md bg-transparent pl-10 pr-3 text-[15px] text-ink outline-none placeholder:text-muted"
              defaultValue={query}
              name="q"
              placeholder="Company name"
              type="search"
            />
          </label>
          <button
            className="rounded-md bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            type="submit"
          >
            Search
          </button>
        </Form>
      </PageHero>

      <section className="py-10 sm:py-12">
        <Container>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="text-sm text-body">
              <span className="font-semibold text-ink">{companies.length}</span>{" "}
              {companies.length === 1 ? "company" : "companies"}
              {query ? <> matching &ldquo;{query}&rdquo;</> : null}
            </p>
            {query ? (
              <Link className="text-sm font-medium text-brand hover:text-brand-dark" href="/companies">
                Clear search
              </Link>
            ) : null}
          </div>

          {companies.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => (
                <Link
                  className="group flex items-center gap-4 rounded-lg border border-line bg-white p-4 transition-colors hover:border-ink/25"
                  href={`/companies/${company.slug}`}
                  key={company.id}
                >
                  <CompanyLogo logoUrl={company.logoUrl} name={company.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink group-hover:text-brand">
                      {company.name}
                    </span>
                    {company.industry ? (
                      <span className="mt-0.5 block truncate text-sm text-muted">{company.industry}</span>
                    ) : null}
                    <span className="mt-1 block text-sm text-body">
                      {company._count.jobs} open {company._count.jobs === 1 ? "role" : "roles"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
              <h2 className="text-lg font-semibold text-ink">
                {query ? `No companies match “${query}”` : "No companies listed yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-body">
                {query
                  ? "Check the spelling, or try a shorter name."
                  : "Companies will appear here once they have jobs listed."}
              </p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
