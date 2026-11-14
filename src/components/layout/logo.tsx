import Image from "next/image";
import Link from "next/link";

export function Logo({
  tone = "dark",
  onClick,
  preload = false,
}: {
  tone?: "dark" | "light";
  onClick?: () => void;
  preload?: boolean;
}) {
  return (
    <Link
      aria-label="JobDraftly home"
      className="inline-flex items-center gap-2.5"
      href="/"
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className={`grid size-10 shrink-0 place-items-center ${tone === "light" ? "rounded-xl bg-white p-1 shadow-sm" : ""}`}
      >
        <Image
          alt=""
          className="size-full object-contain"
          height={40}
          preload={preload}
          src="/brand/jobdraftly-mark.png"
          width={40}
        />
      </span>
      <span
        className={`font-display text-lg font-bold tracking-[-0.02em] ${tone === "light" ? "text-white" : "text-ink"}`}
      >
        JobDraftly
      </span>
    </Link>
  );
}
