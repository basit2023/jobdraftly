import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon aria-hidden="true" className="size-5.5" />
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#0b1f3a]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {action ? (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-700"
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
