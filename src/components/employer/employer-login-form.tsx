"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { inputClass, Notice } from "./ui";

export function EmployerLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await signIn("employer-credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (!result?.ok) {
      setError("The email or password is incorrect, or this login has been switched off. After 5 failed tries, wait 15 minutes.");
      return;
    }
    router.replace("/employer/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Work email</span>
        <input autoComplete="username" className={inputClass} name="email" required type="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
        <input autoComplete="current-password" className={inputClass} name="password" required type="password" />
      </label>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-sm font-medium text-white hover:bg-brand disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
