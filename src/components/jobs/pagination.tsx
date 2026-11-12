import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

function pageHref(
  basePath: string,
  params: Record<string, string>,
  page: number,
): string {
  const search = new URLSearchParams(params);
  if (page <= 1) search.delete("page");
  else search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const visiblePages = Array.from(
    new Set(
      [1, page - 1, page, page + 1, totalPages].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  ).sort((a, b) => a - b);

  return (
    <nav aria-label="Job results pages" className="mt-10 flex items-center justify-center gap-2">
      <Link
        aria-disabled={page <= 1}
        className={`grid size-10 place-items-center rounded-md border text-sm ${
          page <= 1
            ? "pointer-events-none border-line text-line"
            : "border-line bg-white text-ink hover:border-ink/30"
        }`}
        href={pageHref(basePath, params, Math.max(1, page - 1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        <span className="sr-only">Previous page</span>
      </Link>

      {visiblePages.map((value, index) => {
        const previous = visiblePages[index - 1];
        return (
          <span className="contents" key={value}>
            {previous && value - previous > 1 ? (
              <span aria-hidden="true" className="px-1 text-muted">
                …
              </span>
            ) : null}
            <Link
              aria-current={value === page ? "page" : undefined}
              className={`grid size-10 place-items-center rounded-md border text-sm font-medium ${
                value === page
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-ink/30"
              }`}
              href={pageHref(basePath, params, value)}
            >
              {value}
            </Link>
          </span>
        );
      })}

      <Link
        aria-disabled={page >= totalPages}
        className={`grid size-10 place-items-center rounded-md border text-sm ${
          page >= totalPages
            ? "pointer-events-none border-line text-line"
            : "border-line bg-white text-ink hover:border-ink/30"
        }`}
        href={pageHref(basePath, params, Math.min(totalPages, page + 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
        <span className="sr-only">Next page</span>
      </Link>
    </nav>
  );
}
