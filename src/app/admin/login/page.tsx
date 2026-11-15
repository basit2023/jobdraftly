import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = { title: "Administrator Login" };

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id && session.user.kind === "admin") redirect("/admin/dashboard");

  return (
    <main className="grid min-h-screen bg-[#07182d] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="page-grid hidden items-center p-12 text-white lg:flex">
        <div className="mx-auto max-w-xl">
          <span className="grid size-14 place-items-center rounded-2xl bg-blue-500">
            <ShieldCheck aria-hidden="true" className="size-7" />
          </span>
          <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-300">Protected operations</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-tight tracking-[-0.05em]">Manage trusted job discovery for Pakistan.</h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">Review sources, maintain accurate vacancies, and publish only verified application journeys.</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-950/10 sm:p-9">
          <Link className="text-sm font-extrabold text-blue-700" href="/">← Public website</Link>
          <h2 className="mt-7 text-3xl font-extrabold tracking-[-0.04em] text-[#0b1f3a]">Administrator sign in</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use an active administrator account created through the secure setup command.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
