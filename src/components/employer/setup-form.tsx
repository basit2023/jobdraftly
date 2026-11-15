"use client";

import { useFormAction } from "@/components/forms/use-form-action";

import { initialFormState, type FormState } from "@/lib/validations/employer";

import { StateMessage, Submit } from "./form-bits";
import { Field, inputClass } from "./ui";

export function SetupForm({ action }: { action: (state: FormState, formData: FormData) => Promise<FormState> }) {
  const { state, onSubmit, pending, messageRef } = useFormAction(action, initialFormState);
  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <StateMessage messageRef={messageRef} state={state} />
      <Field error={state.errors?.password} hint="At least 10 characters, with a letter and a number." label="New password">
        <input autoComplete="new-password" className={inputClass} minLength={10} name="password" required type="password" />
      </Field>
      <Field error={state.errors?.confirmPassword} label="Type it again">
        <input autoComplete="new-password" className={inputClass} minLength={10} name="confirmPassword" required type="password" />
      </Field>
      <Submit label="Save password" pending={pending} />
    </form>
  );
}
