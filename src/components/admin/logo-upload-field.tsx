"use client";

import { ImageUp, LoaderCircle } from "lucide-react";
import { useState } from "react";

export function LogoUploadField({ initialUrl = "" }: { initialUrl?: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    const data = new FormData();
    data.set("file", file);
    try {
      const response = await fetch("/api/admin/uploads/company-logo", { method: "POST", body: data });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Upload failed.");
        return;
      }
      setUrl(result.url);
      setMessage("Logo uploaded and ready to save.");
    } catch {
      setMessage("Upload failed. Check the connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input name="logoUrl" type="hidden" value={url} />
      <label className="block text-xs font-bold text-slate-600">Company logo</label>
      <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 hover:border-blue-300">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
          {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <ImageUp className="size-5" />}
        </span>
        <span>
          <span className="block text-sm font-extrabold text-slate-800">{uploading ? "Uploading…" : "Upload PNG, JPEG, or WebP"}</span>
          <span className="block text-xs text-slate-500">Maximum 2 MB; file contents are validated.</span>
        </span>
        <input accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => upload(event.target.files?.[0])} type="file" />
      </label>
      {url ? <p className="mt-2 break-all text-xs text-slate-500">Stored path: {url}</p> : null}
      {message ? <p aria-live="polite" className="mt-2 text-xs font-semibold text-blue-700">{message}</p> : null}
    </div>
  );
}
