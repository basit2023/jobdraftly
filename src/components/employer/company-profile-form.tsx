"use client";

import { useFormAction } from "@/components/forms/use-form-action";

import { initialFormState, type FormState } from "@/lib/validations/employer";

import { StateMessage, Submit } from "./form-bits";
import { Field, inputClass, textareaClass } from "./ui";

type Option = { id: string; name: string };

export function CompanyProfileForm({
  action,
  defaults,
  cities,
  canEdit,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: { description: string; websiteUrl: string; industry: string; locationId: string };
  cities: Option[];
  canEdit: boolean;
}) {
  const { state, onSubmit, pending, messageRef } = useFormAction(action, initialFormState);
  const errors = state.errors ?? {};
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <StateMessage messageRef={messageRef} state={state} />
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={!canEdit}>
        <Field error={errors.websiteUrl} label="Website">
          <input className={inputClass} defaultValue={defaults.websiteUrl} name="websiteUrl" placeholder="https://yourcompany.com" type="url" />
        </Field>
        <Field error={errors.industry} label="Industry">
          <input className={inputClass} defaultValue={defaults.industry} maxLength={120} name="industry" placeholder="e.g. Textiles" />
        </Field>
        <Field label="Head office city">
          <select className={inputClass} defaultValue={defaults.locationId} name="locationId">
            <option value="">Not specified</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </Field>
        <Field error={errors.description} hint="Shown on your company page and next to every job." label="About the company" wide>
          <textarea className={`${textareaClass} min-h-40`} defaultValue={defaults.description} maxLength={5_000} name="description" />
        </Field>
      </fieldset>
      {canEdit ? <Submit label="Save profile" pending={pending} /> : <p className="text-sm text-muted">Only your company&apos;s account owner can change the profile.</p>}
    </form>
  );
}
