import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function SectionHeading({
  title,
  description,
  link,
  as: Tag = "h2",
}: Readonly<{
  title: string;
  description?: string;
  link?: { href: string; label: string };
  as?: "h2" | "h3";
}>) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <Tag className="text-2xl font-bold text-ink sm:text-[28px]">{title}</Tag>
        {description ? (
          <p className="mt-2 text-[15px] leading-7 text-body">{description}</p>
        ) : null}
      </div>
      {link ? (
        <Link
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
          href={link.href}
        >
          {link.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
