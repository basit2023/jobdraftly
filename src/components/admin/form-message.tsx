import type { AdminFormState } from "@/lib/validations/admin-forms";

export function FormMessage({ state, messageRef }: { state: AdminFormState; messageRef?: React.Ref<HTMLDivElement> }) {
  if (!state.message) return null;
  return (
    <div
      ref={messageRef}
      aria-live="polite"
      className={`rounded-xl p-4 text-sm ${state.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
    >
      <p className="font-bold">{state.message}</p>
      {state.errors ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {Object.entries(state.errors).flatMap(([field, messages]) =>
            messages.map((message) => <li key={`${field}-${message}`}>{message}</li>),
          )}
        </ul>
      ) : null}
    </div>
  );
}
