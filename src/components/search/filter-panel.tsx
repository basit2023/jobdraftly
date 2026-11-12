"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

/**
 * On small screens the filters collapse behind a toggle so results stay near
 * the top of the page. On large screens they are always visible.
 */
export function FilterPanel({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        aria-controls="job-filters"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-ink lg:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filters
          {activeCount ? (
            <span className="rounded bg-brand-tint px-1.5 text-xs font-semibold text-brand">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} lg:mt-0 lg:block`} id="job-filters">
        {children}
      </div>
    </div>
  );
}
