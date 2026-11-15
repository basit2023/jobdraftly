"use client";

import { useFormAction } from "@/components/forms/use-form-action";

import type { AdminFormState } from "@/lib/validations/admin-forms";
import { initialAdminFormState } from "@/lib/validations/admin-forms";

import { FormMessage } from "./form-message";
import { SubmitButton } from "./form-controls";

type Option = { id: string; name: string };

export type JobFormDefaults = {
  title?: string;
  companyId?: string;
  categoryId?: string;
  locationId?: string;
  description?: string;
  responsibilities?: string | null;
  requirements?: string | null;
  skills?: string | null;
  employmentType?: string;
  experienceLevel?: string;
  education?: string | null;
  salaryMin?: string;
  salaryMax?: string;
  salaryCurrency?: string;
  salaryVisibility?: string;
  salaryPeriod?: string | null;
  workplaceType?: string;
  applicationMethod?: string;
  applicationUrl?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  status?: string;
  applicationDeadline?: string;
  expiresAt?: string;
  isFeatured?: boolean;
};

export function JobForm({
  action,
  defaults = {},
  companies,
  categories,
  locations,
  sources,
  imported = false,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  defaults?: JobFormDefaults;
  companies: Option[];
  categories: Option[];
  locations: Option[];
  sources: Option[];
  imported?: boolean;
}) {
  const { state, onSubmit, pending, messageRef } = useFormAction(action, initialAdminFormState);
  const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-blue-400";
  const textarea = `${input} min-h-36 py-3 leading-6`;

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <FormMessage messageRef={messageRef} state={state} />
      {imported ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This vacancy was imported. Confirm its source and application destination before changing the status to Published.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Vacancy essentials</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Job title" wide><input className={input} defaultValue={defaults.title} maxLength={191} name="title" required /></Field>
          <Field label="Company"><select className={input} defaultValue={defaults.companyId ?? ""} name="companyId" required><option value="">Select company</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Category"><select className={input} defaultValue={defaults.categoryId ?? ""} name="categoryId" required><option value="">Select category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Location"><select className={input} defaultValue={defaults.locationId ?? ""} name="locationId" required><option value="">Select city</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Employment type"><select className={input} defaultValue={defaults.employmentType ?? "FULL_TIME"} name="employmentType">{[["FULL_TIME","Full-time"],["PART_TIME","Part-time"],["CONTRACT","Contract"],["TEMPORARY","Temporary"],["INTERNSHIP","Internship"],["FREELANCE","Freelance"],["OTHER","Other"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Experience level"><select className={input} defaultValue={defaults.experienceLevel ?? "NOT_SPECIFIED"} name="experienceLevel">{[["NOT_SPECIFIED","Not specified"],["ENTRY_LEVEL","Entry level"],["JUNIOR","Junior"],["MID_LEVEL","Mid level"],["SENIOR","Senior"],["LEAD","Lead"],["MANAGER","Manager"],["DIRECTOR","Director"],["EXECUTIVE","Executive"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Workplace type"><select className={input} defaultValue={defaults.workplaceType ?? "ONSITE"} name="workplaceType"><option value="NOT_SPECIFIED">Not specified</option><option value="ONSITE">On-site</option><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option></select></Field>
          <Field label="Education"><input className={input} defaultValue={defaults.education ?? ""} maxLength={191} name="education" /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Job content</h2>
        <div className="mt-5 space-y-5">
          <Field label="Description"><textarea className={textarea} defaultValue={defaults.description} name="description" required /></Field>
          <Field label="Responsibilities"><textarea className={textarea} defaultValue={defaults.responsibilities ?? ""} name="responsibilities" /></Field>
          <Field label="Requirements"><textarea className={textarea} defaultValue={defaults.requirements ?? ""} name="requirements" /></Field>
          <Field label="Skills" hint="Separate skills with commas or line breaks."><textarea className={`${textarea} min-h-24`} defaultValue={defaults.skills ?? ""} name="skills" /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Salary and dates</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Minimum salary"><input className={input} defaultValue={defaults.salaryMin} min="0" name="salaryMin" step="0.01" type="number" /></Field>
          <Field label="Maximum salary"><input className={input} defaultValue={defaults.salaryMax} min="0" name="salaryMax" step="0.01" type="number" /></Field>
          <Field label="Currency"><input className={input} defaultValue={defaults.salaryCurrency ?? "PKR"} maxLength={3} name="salaryCurrency" /></Field>
          <Field label="Salary visibility"><select className={input} defaultValue={defaults.salaryVisibility ?? "HIDDEN"} name="salaryVisibility"><option value="HIDDEN">Hidden</option><option value="RANGE">Range</option><option value="EXACT">Exact</option><option value="NEGOTIABLE">Negotiable</option></select></Field>
          <Field label="Salary period"><select className={input} defaultValue={defaults.salaryPeriod ?? ""} name="salaryPeriod"><option value="">Not specified</option><option value="HOUR">Per hour</option><option value="DAY">Per day</option><option value="WEEK">Per week</option><option value="MONTH">Per month</option><option value="YEAR">Per year</option></select></Field>
          <Field label="Application deadline"><input className={input} defaultValue={defaults.applicationDeadline} name="applicationDeadline" type="datetime-local" /></Field>
          <Field label="Expires at"><input className={input} defaultValue={defaults.expiresAt} name="expiresAt" type="datetime-local" /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Application and source</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Application method"><select className={input} defaultValue={defaults.applicationMethod ?? "EXTERNAL_URL"} name="applicationMethod"><option value="EXTERNAL_URL">External URL</option><option value="ON_SITE">Apply on JobDraftly (CV)</option><option value="EMAIL">Email/instructions</option><option value="INSTRUCTIONS">Instructions</option></select></Field>
          <Field label="Verified application URL"><input className={input} defaultValue={defaults.applicationUrl ?? ""} name="applicationUrl" placeholder="https://employer.example/apply" type="url" /></Field>
          <Field label="Source"><select className={input} defaultValue={defaults.sourceId ?? ""} name="sourceId"><option value="">No source selected</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Original source URL"><input className={input} defaultValue={defaults.sourceUrl ?? ""} name="sourceUrl" placeholder="https://source.example/vacancy" type="url" /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-[#0b1f3a]">Publishing</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field label="Status"><select className={input} defaultValue={defaults.status ?? "DRAFT"} name="status"><option value="DRAFT">Draft</option><option value="PENDING_REVIEW">Pending review</option><option value="PUBLISHED">Published</option><option value="REJECTED">Rejected</option><option value="EXPIRED">Expired</option><option value="CLOSED">Closed</option></select></Field>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"><input defaultChecked={defaults.isFeatured} name="isFeatured" type="checkbox" /> Featured vacancy</label>
        </div>
      </section>

      <div className="flex justify-end"><SubmitButton label="Save job" pending={pending} /></div>
    </form>
  );
}

function Field({ label, hint, wide = false, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "block md:col-span-2" : "block"}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}{hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}</label>;
}
