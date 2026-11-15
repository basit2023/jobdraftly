"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

type ResultState = { success: boolean; message: string };

/**
 * Runs a server action from a form WITHOUT React's automatic form reset.
 *
 * With `<form action={…}>`, React 19 clears every field once the action finishes,
 * even when it only returned validation errors, so people had to retype everything.
 * Submitting through this hook keeps what they typed; only the error messages change.
 *
 * `resetOnSuccess` clears the form after a successful save (for "add another" forms).
 */
export function useFormAction<S extends ResultState>(
  action: (state: S, formData: FormData) => Promise<S>,
  initialState: S,
  options: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(
    action as (state: Awaited<S>, payload: FormData) => Promise<S>,
    initialState as Awaited<S>,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Include the clicked button's name/value, as a normal form submission would.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  const { resetOnSuccess } = options;
  useEffect(() => {
    if (!state.message) return;
    if (state.success && resetOnSuccess) formRef.current?.reset();
    // Long forms show the message at the top; bring it into view.
    if (!state.success) messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state, resetOnSuccess]);

  return { state, onSubmit, pending, formRef, messageRef };
}
