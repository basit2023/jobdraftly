import type { Metadata } from "next";
import Link from "next/link";

import { completeSetupAction } from "@/app/employer/actions";
import { AuthShell } from "@/components/employer/auth-shell";
import { SetupForm } from "@/components/employer/setup-form";
import { Notice } from "@/components/employer/ui";
import { findValidSetupToken } from "@/lib/services/employer-accounts";

export const metadata: Metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function EmployerSetupPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const user = await findValidSetupToken(token);

  if (!user) {
    return (
      <AuthShell description="Setup links work once and expire after 72 hours." title="This link no longer works">
        <div className="mt-5">
          <Notice tone="warning">Ask the person who sent it (your company owner or JobDraftly) for a new link.</Notice>
        </div>
        <Link className="mt-5 inline-block text-sm font-medium text-brand underline" href="/employer/login">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell description={`Hi ${user.name}. Choose a password for ${user.email} to manage ${user.company.name} on JobDraftly.`} title="Set your password">
      <SetupForm action={completeSetupAction.bind(null, token)} />
    </AuthShell>
  );
}
