"use client";

import { useFormAction } from "@/components/forms/use-form-action";

import { initialFormState, type FormState } from "@/lib/validations/employer";

import { StateMessage, Submit } from "./form-bits";
import { textareaClass } from "./ui";

export function NotesForm({ action, defaultValue }: { action: (state: FormState, formData: FormData) => Promise<FormState>; defaultValue: string }) {
  const { state, onSubmit, pending } = useFormAction(action, initialFormState);
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <textarea aria-label="Private notes" className={textareaClass} defaultValue={defaultValue} maxLength={5_000} name="notes" placeholder="Interview feedback, salary expectations, next steps…" />
      <div className="flex items-center gap-3">
        <Submit label="Save notes" pending={pending} tone="secondary" />
      </div>
      <StateMessage state={state} />
    </form>
  );
}
