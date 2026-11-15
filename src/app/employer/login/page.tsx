import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/employer/auth-shell";
import { EmployerLoginForm } from "@/components/employer/employer-login-form";
import { Notice } from "@/components/employer/ui";
import { authOptions } from "@/lib/auth/options";

export const metadata: Metadata = { title: "Sign in" };

export default async function EmployerLoginPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.kind === "employer") redirect("/employer/dashboard");
  const { setup } = await searchParams;

  return (
    <AuthShell description="Post jobs, review applicants and see how your listings perform." title="Sign in to your company account">
      {setup === "done" ? (
        <div className="mt-5">
          <Notice tone="success">Your password is set. Sign in to continue.</Notice>
        </div>
      ) : null}
      <EmployerLoginForm />
      <p className="mt-5 text-xs leading-5 text-muted">
        Forgot your password? Ask your company&apos;s account owner for a new setup link.
      </p>
    </AuthShell>
  );
}
