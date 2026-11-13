import { X } from "lucide-react";
import Link from "next/link";

export type ActiveFilter = { param: string; label: string };

/** Removable chips for the filters currently applied, above the job results. */
export function ActiveFilters({
  basePath,
  filters,
  params,
}: {
  basePath: string;
  filters: ActiveFilter[];
  params: Record<string, string>;
}) {
  if (!filters.length) return null;

  const hrefWithout = (param: string) => {
    const next = new URLSearchParams(params);
    next.delete(param);
    next.delete("page");
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Link
          aria-label={`Remove filter: ${filter.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-3 pr-2 text-xs font-medium text-ink hover:border-ink/30"
          href={hrefWithout(filter.param)}
          key={filter.param}
        >
          {filter.label}
          <X aria-hidden="true" className="size-3.5 text-muted" />
        </Link>
      ))}
      {filters.length > 1 ? (
        <Link className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink" href={basePath}>
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
