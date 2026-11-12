import Link from "next/link";

export default function PublicNotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24">
      <p className="font-display text-sm font-bold text-muted">404</p>
      <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">Page not found</h1>
      <p className="mt-3 text-[15px] leading-7 text-body">
        This page doesn&apos;t exist, or the job has closed and been taken down.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-brand"
          href="/jobs"
        >
          Browse jobs
        </Link>
        <Link
          className="rounded-md border border-line bg-white px-5 py-2.5 text-sm font-medium text-ink hover:border-ink/30"
          href="/"
        >
          Go to homepage
        </Link>
      </div>
    </section>
  );
}
