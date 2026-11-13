
import { PageHero } from "@/components/layout/page-hero";
import { Container } from "@/components/ui/container";
import { pageMetadata } from "@/lib/seo/site";
import { CONTACT_EMAIL } from "@/lib/site-contact";

export const metadata = pageMetadata({
  title: "Contact us",
  description: "Contact JobDraftly to list a vacancy, report an outdated or suspicious job listing, or send us a question or feedback about the site.",
  path: "/contact",
});

const subjects = [
  { value: "general", label: "General question" },
  { value: "employer", label: "I want to list a job" },
  { value: "correction", label: "Report a problem with a listing" },
] as const;

const reasons = [
  {
    title: "Employers",
    description: "Send us your vacancy and a link to your application page, and we'll take it from there.",
  },
  {
    title: "Problems with a listing",
    description:
      "If a job has closed, has wrong details or asks you to pay a fee, tell us which one and we'll look into it.",
  },
  {
    title: "Everything else",
    description: "Questions, feedback and ideas for the site are always welcome.",
  },
] as const;

type SearchParams = Promise<{ topic?: string | string[] }>;

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const rawTopic = (await searchParams).topic;
  const topic = Array.isArray(rawTopic) ? rawTopic[0] : rawTopic;
  const defaultSubject = subjects.some((subject) => subject.value === topic) ? topic : "general";

  const contactEmail = CONTACT_EMAIL;
  const inputClass =
    "min-h-11 w-full rounded-md border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-muted focus:border-brand";
  const labelClass = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <>
      <PageHero
        description="Whether you're hiring or something on the site needs fixing, send us a message."
        title="Contact us"
      />
      <section className="py-10 sm:py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div className="space-y-8">
              {reasons.map(({ title, description }) => (
                <div key={title}>
                  <h2 className="text-base font-semibold text-ink">{title}</h2>
                  <p className="mt-1.5 text-[15px] leading-7 text-body">{description}</p>
                </div>
              ))}
              {contactEmail ? (
                <p className="border-t border-line pt-6 text-[15px] text-body">
                  Or email us directly at{" "}
                  <a className="font-medium text-brand underline underline-offset-2" href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
              {contactEmail ? (
                <form
                  action={`mailto:${contactEmail}`}
                  className="space-y-5"
                  encType="text/plain"
                  method="post"
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Your name</span>
                      <input autoComplete="name" className={inputClass} name="name" required type="text" />
                    </label>
                    <label>
                      <span className={labelClass}>Email</span>
                      <input autoComplete="email" className={inputClass} name="email" required type="email" />
                    </label>
                  </div>
                  <label className="block">
                    <span className={labelClass}>What&apos;s this about?</span>
                    <select className={inputClass} defaultValue={defaultSubject} name="subject">
                      {subjects.map((subject) => (
                        <option key={subject.value} value={subject.value}>
                          {subject.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Message</span>
                    <textarea className={`${inputClass} min-h-40 py-3`} name="message" required />
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted">This opens your email app with the message filled in.</p>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                      type="submit"
                    >
                      Send message
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold text-ink">Contact form unavailable</h2>
                  <p className="mt-2 text-[15px] leading-7 text-body">
                    Our contact form isn&apos;t available right now. Please check back soon.
                  </p>
                  {process.env.NODE_ENV !== "production" ? (
                    <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                      Developer note: set{" "}
                      <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_CONTACT_EMAIL</code>{" "}
                      to a valid address to enable this form.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
