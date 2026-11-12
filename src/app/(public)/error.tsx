"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PublicError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-24">
      <p className="font-display text-sm font-bold text-muted">Error</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Something went wrong</h1>
      <p className="mt-3 text-[15px] leading-7 text-body">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-brand"
          onClick={retry}
          type="button"
        >
          Try again
        </button>
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
