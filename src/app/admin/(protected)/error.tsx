"use client";

import { CircleAlert } from "lucide-react";

export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm"><CircleAlert className="mx-auto size-8 text-red-600" /><h1 className="mt-4 text-2xl font-extrabold text-[#0b1f3a]">The administrator page could not be loaded</h1><p className="mt-2 text-sm text-slate-600">No action was completed. Retry the request or return to the dashboard.</p><button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white" onClick={() => retry()} type="button">Try again</button></div>;
}
