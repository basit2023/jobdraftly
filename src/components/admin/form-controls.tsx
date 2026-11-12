"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-65"
      disabled={pending}
      type="submit"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ConfirmSubmitButton({
  label,
  message,
  tone = "danger",
}: {
  label: string;
  message: string;
  tone?: "danger" | "neutral";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`rounded-lg px-3 py-2 text-xs font-extrabold disabled:opacity-50 ${tone === "danger" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      type="submit"
    >
      {pending ? "Working…" : label}
    </button>
  );
}
