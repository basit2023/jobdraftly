import Link from "next/link";

import { PageHero } from "@/components/layout/page-hero";
import { Container } from "@/components/ui/container";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata({
  title: "About us",
  description:
    "JobDraftly lists jobs from approved employers across Pakistan and links you straight to the employer's own application page. No sign-up, no fees.",
  path: "/about",
});

const principles = [
  {
    title: "Real jobs only",
    description:
      "Listings come only from employers and sources we've approved, and anything our system isn't sure about is checked by a person first. We don't make up vacancies, and listings come down automatically when they close.",
  },
  {
    title: "Apply where the job is",
    description:
      "We link you to the employer's own application page or the original advert. No extra sign-up, and no middleman between you and the employer.",
  },
  {
    title: "Search the way you think",
    description:
      "Filter by city, job type, experience and salary, and share any search with a link.",
  },
  {
    title: "Made for Pakistan",
    description:
      "Cities, provinces, government roles and salaries in rupees. The site is built around how people in Pakistan look for work.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero
        description="JobDraftly brings job openings from across Pakistan into one place, then gets out of the way so you can apply directly."
        title="About JobDraftly"
      />
      <section className="py-12 sm:py-16">
        <Container>
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {principles.map(({ title, description }) => (
              <article className="border-t-2 border-ink pt-5" key={title}>
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-[15px] leading-7 text-body">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 max-w-2xl border-t border-line pt-8">
            <h2 className="text-xl font-bold text-ink">Get in touch</h2>
            <p className="mt-2 text-[15px] leading-7 text-body">
              Spotted a listing that&apos;s out of date, or want to list your vacancies?{" "}
              <Link className="font-medium text-brand underline underline-offset-2" href="/contact">
                Contact us
              </Link>
              .
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
