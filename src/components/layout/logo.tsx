import Link from "next/link";

export function Logo({
  tone = "dark",
  onClick,
}: {
  tone?: "dark" | "light";
  onClick?: () => void;
}) {
  return (
    <Link
      aria-label="JobDraftly home"
      className="inline-flex items-center gap-2"
      href="/"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-md bg-brand font-display text-sm font-bold text-white"
      >
        J
      </span>
      <span
        className={`font-display text-lg font-bold tracking-[-0.02em] ${tone === "light" ? "text-white" : "text-ink"}`}
      >
        JobDraftly
      </span>
    </Link>
  );
}
