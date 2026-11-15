"use client";

import { CheckCircle2, LoaderCircle, Paperclip } from "lucide-react";
import { useState } from "react";

const input =
  "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand";

/** Apply-with-CV form for jobs that take applications on JobDraftly. */
export function ApplyForm({ jobId, jobTitle, companyName }: { jobId: string; jobTitle: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState("");

  if (done) {
    return (
      <div className="rounded-md bg-brand-tint p-4 text-sm leading-6 text-brand-dark" role="status">
        <CheckCircle2 aria-hidden="true" className="mb-2 size-5" />
        <p className="font-semibold">Application sent</p>
        <p className="mt-1">{companyName} has your CV. If they&apos;d like to talk, they&apos;ll contact you by phone or email.</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-sm font-medium text-white hover:bg-brand" onClick={() => setOpen(true)} type="button">
        Apply now
      </button>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST", body: new FormData(event.currentTarget) });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string; field?: string } | null;
      setError({
        message: response.status === 429 ? "Too many applications from this connection. Please try again later." : body?.error ?? "Your application could not be sent. Please try again.",
        field: body?.field,
      });
    } catch {
      setError({ message: "No connection. Check your internet and try again." });
    } finally {
      setPending(false);
    }
  }

  const errorFor = (field: string) =>
    error?.field === field ? <span className="mt-1 block text-xs text-red-700">{error.message}</span> : null;

  return (
    <form className="space-y-3.5" encType="multipart/form-data" noValidate={false} onSubmit={submit}>
      <p className="text-sm font-semibold text-ink">Apply for {jobTitle}</p>
      {error && !error.field ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{error.message}</p> : null}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">Full name</span>
        <input autoComplete="name" className={input} maxLength={120} name="fullName" required />
        {errorFor("fullName")}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">Email</span>
        <input autoComplete="email" className={input} maxLength={191} name="email" required type="email" />
        {errorFor("email")}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">Mobile number</span>
        <input autoComplete="tel" className={input} inputMode="tel" maxLength={30} name="phone" placeholder="0300 1234567" required type="tel" />
        {errorFor("phone")}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">City (optional)</span>
        <input autoComplete="address-level2" className={input} maxLength={120} name="city" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">CV</span>
        <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line bg-paper px-3 text-sm text-body hover:border-ink/30">
          <Paperclip aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{fileName || "Choose PDF or Word file (max 5 MB)"}</span>
          <input
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            name="cv"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            required
            type="file"
          />
        </span>
        {errorFor("cv")}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-body">Message to the employer (optional)</span>
        <textarea className={`${input} min-h-24 py-2 leading-6`} maxLength={5_000} name="coverLetter" />
      </label>
      {/* Spam trap: hidden from people, filled in by bots. */}
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      <label className="flex gap-2 text-xs leading-5 text-body">
        <input className="mt-0.5" name="consent" required type="checkbox" />
        <span>I agree that {companyName} can see my details and CV for this job. JobDraftly deletes applications after 12 months.</span>
      </label>
      {errorFor("consent")}

      <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-white hover:bg-brand disabled:opacity-60" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
        {pending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
