import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted">
        {items.map((item, index) => (
          <li className="flex min-w-0 items-center gap-1" key={item.href}>
            {index ? <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="truncate text-body">
                {item.name}
              </span>
            ) : (
              <Link className="hover:text-ink hover:underline" href={item.href}>
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
