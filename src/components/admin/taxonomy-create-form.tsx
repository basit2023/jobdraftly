"use client";

import { useFormAction } from "@/components/forms/use-form-action";

import type { AdminFormState } from "@/lib/validations/admin-forms";
import { initialAdminFormState } from "@/lib/validations/admin-forms";

import { FormMessage } from "./form-message";
import { SubmitButton } from "./form-controls";

export function TaxonomyCreateForm({
  kind,
  action,
  parents = [],
}: {
  kind: "category" | "location" | "source";
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  parents?: { id: string; name: string }[];
}) {
  const { state, onSubmit, pending, formRef, messageRef } = useFormAction(action, initialAdminFormState, { resetOnSuccess: true });
  const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400";
  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={onSubmit} ref={formRef}>
      <h2 className="text-lg font-extrabold text-[#0b1f3a]">Add {kind}</h2>
      <FormMessage messageRef={messageRef} state={state} />
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Name</span><input className={input} maxLength={120} name="name" required /></label>
      {kind === "category" ? <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Parent category</span><select className={input} name="parentId"><option value="">None</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Description</span><textarea className={`${input} min-h-24 py-3`} name="description" /></label></> : null}
      {kind === "location" ? <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Type</span><select className={input} defaultValue="CITY" name="type"><option value="CITY">City</option><option value="PROVINCE">Province</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Province (required for cities)</span><select className={input} name="provinceId"><option value="">Select province</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : null}
      {kind === "source" ? <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Source type</span><select className={input} defaultValue="CSV" name="type"><option value="MANUAL">Manual</option><option value="CSV">CSV</option><option value="XML_FEED">XML feed</option><option value="API">API</option><option value="EMPLOYER_WEBSITE">Employer website</option><option value="JOB_BOARD">Job board</option><option value="GOVERNMENT_PORTAL">Government portal</option></select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Base URL</span><input className={input} name="baseUrl" type="url" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Terms URL</span><input className={input} name="termsUrl" type="url" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Authorized feed or monitored page</span><input className={input} name="feedUrl" placeholder="HTTPS only" type="url" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Attribution text</span><input className={input} maxLength={255} name="attributionText" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Permission evidence / notes</span><textarea className={`${input} min-h-24 py-3`} name="permissionNotes" /></label></> : null}
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Sort order</span><input className={input} defaultValue="0" min="0" name="sortOrder" type="number" /></label>
      <SubmitButton label={`Add ${kind}`} pending={pending} />
    </form>
  );
}
