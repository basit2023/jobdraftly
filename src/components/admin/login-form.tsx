"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { adminLoginSchema } from "@/lib/validations/admin-auth";

type LoginInput = z.infer<typeof adminLoginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(adminLoginSchema) });

  async function submit(values: LoginInput) {
    setMessage("");
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!result?.ok) {
      setMessage("The email or password is incorrect, or this account is inactive.");
      return;
    }

    router.replace("/admin/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={handleSubmit(submit)}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-600">Email address</span>
        <input
          autoComplete="username"
          className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400"
          type="email"
          {...register("email")}
        />
        {errors.email ? <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-600">Password</span>
        <input
          autoComplete="current-password"
          className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400"
          type="password"
          {...register("password")}
        />
        {errors.password ? <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span> : null}
      </label>
      {message ? (
        <p aria-live="polite" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
        {isSubmitting ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
