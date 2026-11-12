"use client";

import { useFormStatus } from "react-dom";

export function SearchButton({
  label = "Search",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-75 ${className}`}
      disabled={pending}
      type="submit"
    >
      {pending ? "Searching…" : label}
    </button>
  );
}
