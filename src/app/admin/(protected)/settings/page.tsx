import { KeyRound, Settings, ShieldCheck } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const record = await db.admin.findUnique({ where: { id: admin.id }, select: { createdAt: true, lastLoginAt: true } });
  return <><AdminPageHeader description="Review the current administrator identity and platform security configuration." icon={Settings} title="Settings" /><div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck className="size-5" /></span><h2 className="mt-5 text-xl font-extrabold text-[#0b1f3a]">Signed-in administrator</h2><dl className="mt-5 space-y-4 text-sm"><Row label="Name" value={admin.name} /><Row label="Email" value={admin.email} /><Row label="Role" value={admin.role.replaceAll("_", " ")} /><Row label="Account created" value={formatDate(record?.createdAt) ?? "Unknown"} /><Row label="Last login" value={formatDate(record?.lastLoginAt) ?? "Current session"} /></dl></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound className="size-5" /></span><h2 className="mt-5 text-xl font-extrabold text-[#0b1f3a]">Security controls</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600"><li>Administrator sessions expire after eight hours.</li><li>Every protected page checks the active administrator record on the server.</li><li>Every mutation repeats authorization and Zod validation on the server.</li><li>Important mutations and successful sign-ins create audit records.</li><li>New administrators are created only through environment-backed setup.</li></ul><div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">To create another administrator, use the documented setup command with temporary environment variables. Remove those variables immediately after setup.</div></section></div></>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold text-slate-800">{value}</dd></div>; }
