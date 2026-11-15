"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { useFormAction } from "@/components/forms/use-form-action";
import { initialFormState, type FormState } from "@/lib/validations/employer";

import { inputClass, Notice } from "./ui";

export function Submit({ label, pendingLabel = "Saving…", tone = "primary", pending: pendingProp }: { label: string; pendingLabel?: string; tone?: "primary" | "secondary" | "danger"; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  const style = {
    primary: "bg-ink text-white hover:bg-brand",
    secondary: "border border-line bg-white text-ink hover:border-ink/30",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }[tone];
  return (
    <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-wait disabled:opacity-60 ${style}`} disabled={pending} type="submit">
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ConfirmSubmit({ label, message, tone = "secondary" }: { label: string; message: string; tone?: "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`inline-flex min-h-9 items-center rounded-md px-3 text-xs font-medium disabled:opacity-50 ${tone === "danger" ? "border border-red-200 text-red-700 hover:bg-red-50" : "border border-line text-ink hover:border-ink/30"}`}
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

export function StateMessage({ state, messageRef }: { state: FormState; messageRef?: React.Ref<HTMLDivElement> }) {
  if (!state.message) return null;
  return (
    <div ref={messageRef}>
      <Notice tone={state.success ? "success" : "error"}>{state.message}</Notice>
    </div>
  );
}

/** Shows a one-time setup link with a copy button. */
export function SetupLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex gap-2">
      <input aria-label="One-time setup link" className={`${inputClass} font-mono text-xs`} onFocus={(event) => event.currentTarget.select()} readOnly value={link} />
      <button
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:border-ink/30"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2_000);
        }}
        type="button"
      >
        {copied ? <Check aria-hidden="true" className="size-4 text-brand" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** A form whose action returns a setup link (add person / reset link). */
export function LinkActionForm({
  action,
  submitLabel,
  children,
  className = "",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { state, onSubmit, pending, formRef, messageRef } = useFormAction(action, initialFormState, { resetOnSuccess: true });
  return (
    <form className={className} onSubmit={onSubmit} ref={formRef}>
      {children}
      <div className="mt-3">
        <Submit label={submitLabel} pending={pending} pendingLabel="Working…" tone={children ? "primary" : "secondary"} />
      </div>
      {state.message ? (
        <div className="mt-3">
          <StateMessage messageRef={messageRef} state={state} />
          {state.link ? (
            <>
              <SetupLinkBox link={state.link} />
              <p className="mt-1.5 text-xs text-muted">It works once and expires in 72 hours.</p>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
