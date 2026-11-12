"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CsvUploadForm({ sources }: { sources: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/imports/csv", { method: "POST", body: new FormData(event.currentTarget) });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error(result.error ?? "Upload failed.");
      router.push(result.redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPending(false);
    }
  }
  return <form className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={submit}>
    <div><h2 className="text-lg font-extrabold text-[#0b1f3a]">CSV upload</h2><p className="mt-1 text-sm leading-6 text-slate-500">Maximum 2 MB and 1,000 rows. Nothing is published during upload.</p></div>
    {error ? <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Approved source</span><select className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" name="sourceId" required><option value="">Select source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
    <label className="block rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5"><span className="mb-2 block text-sm font-extrabold text-slate-700">CSV file</span><input accept=".csv,text/csv" className="block w-full text-sm" name="file" required type="file" /></label>
    <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white disabled:opacity-60" disabled={pending || !sources.length} type="submit">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}{pending ? "Staging CSV…" : "Upload and map columns"}</button>
  </form>;
}

