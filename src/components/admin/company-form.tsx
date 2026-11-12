"use client";

import { useActionState } from "react";

import type { AdminFormState } from "@/lib/validations/admin-forms";
import { initialAdminFormState } from "@/lib/validations/admin-forms";

import { FormMessage } from "./form-message";
import { LogoUploadField } from "./logo-upload-field";
import { SubmitButton } from "./form-controls";

type Defaults = {
  name?: string;
  legalName?: string | null;
  websiteUrl?: string | null;
  domain?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  locationId?: string | null;
  isVerified?: boolean;
  isActive?: boolean;
};

export function CompanyForm({ action, defaults = {}, cities }: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  defaults?: Defaults;
  cities: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, initialAdminFormState);
  const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-blue-400";
  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Company profile</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Company name"><input className={input} defaultValue={defaults.name} maxLength={191} name="name" required /></Field>
          <Field label="Legal name"><input className={input} defaultValue={defaults.legalName ?? ""} maxLength={191} name="legalName" /></Field>
          <Field label="Website"><input className={input} defaultValue={defaults.websiteUrl ?? ""} name="websiteUrl" placeholder="https://company.example" type="url" /></Field>
          <Field label="Domain"><input className={input} defaultValue={defaults.domain ?? ""} maxLength={191} name="domain" placeholder="company.example" /></Field>
          <Field label="Industry"><input className={input} defaultValue={defaults.industry ?? ""} maxLength={120} name="industry" /></Field>
          <Field label="City"><select className={input} defaultValue={defaults.locationId ?? ""} name="locationId"><option value="">Not specified</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
          <div className="md:col-span-2"><LogoUploadField initialUrl={defaults.logoUrl} /></div>
          <Field label="Description" wide><textarea className={`${input} min-h-40 py-3 leading-6`} defaultValue={defaults.description ?? ""} name="description" /></Field>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"><input defaultChecked={defaults.isVerified} name="isVerified" type="checkbox" /> Verified company</label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"><input defaultChecked={defaults.isActive ?? true} name="isActive" type="checkbox" /> Active company</label>
        </div>
      </section>
      <div className="flex justify-end"><SubmitButton label="Save company" /></div>
    </form>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "block md:col-span-2" : "block"}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}
