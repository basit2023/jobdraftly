import Link from "next/link";

export function EmptyJobs({
  title = "No jobs match your search",
  description = "Try a different keyword, or remove a filter or two.",
  showReset = true,
}: {
  title?: string;
  description?: string;
  showReset?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-body">{description}</p>
      {showReset ? (
        <Link
          className="mt-5 inline-flex rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-ink/30"
          href="/jobs"
        >
          Clear search
        </Link>
      ) : null}
    </div>
  );
}
