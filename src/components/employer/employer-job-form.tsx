"use client";

import { useState } from "react";

import { useFormAction } from "@/components/forms/use-form-action";

import { initialFormState, MAX_EMPLOYER_LISTING_DAYS, type FormState } from "@/lib/validations/employer";

import { StateMessage, Submit } from "./form-bits";
import { Card, Field, inputClass, Notice, textareaClass } from "./ui";

type Option = { id: string; name: string };
type ProvinceOption = Option & { cities: Option[] };

export type EmployerJobDefaults = Partial<{
  title: string;
  categoryId: string;
  locationId: string;
  employmentType: string;
  experienceLevel: string;
  workplaceType: string;
  education: string;
  description: string;
  responsibilities: string;
  requirements: string;
  skills: string;
  salaryMin: string;
  salaryMax: string;
  salaryVisibility: string;
  salaryPeriod: string;
  applicationDeadline: string;
  applicationMethod: string;
  applicationUrl: string;
}>;

const employment = [["FULL_TIME", "Full-time"], ["PART_TIME", "Part-time"], ["CONTRACT", "Contract"], ["TEMPORARY", "Temporary"], ["INTERNSHIP", "Internship"], ["FREELANCE", "Freelance"], ["OTHER", "Other"]];
const experience = [["NOT_SPECIFIED", "Not specified"], ["ENTRY_LEVEL", "Entry level / fresh graduate"], ["JUNIOR", "Junior (1–2 years)"], ["MID_LEVEL", "Mid level (3–5 years)"], ["SENIOR", "Senior (5+ years)"], ["LEAD", "Lead"], ["MANAGER", "Manager"], ["DIRECTOR", "Director"], ["EXECUTIVE", "Executive"]];

export function EmployerJobForm({
  action,
  defaults = {},
  categories,
  provinces,
  goesLiveImmediately,
  minDate,
  maxDate,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: EmployerJobDefaults;
  categories: Option[];
  provinces: ProvinceOption[];
  goesLiveImmediately: boolean;
  minDate: string;
  maxDate: string;
  submitLabel: string;
}) {
  const { state, onSubmit, pending, messageRef } = useFormAction(action, initialFormState);
  const [method, setMethod] = useState(defaults.applicationMethod ?? "ON_SITE");
  const [salaryVisibility, setSalaryVisibility] = useState(defaults.salaryVisibility ?? "RANGE");
  const errors = state.errors ?? {};

  return (
    <form className="space-y-6" noValidate onSubmit={onSubmit}>
      <StateMessage messageRef={messageRef} state={state} />

      <Card title="The job">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.title} label="Job title" wide>
            <input className={inputClass} defaultValue={defaults.title} maxLength={191} name="title" placeholder="e.g. Accounts Officer" required />
          </Field>
          <Field error={errors.categoryId} label="Category">
            <select className={inputClass} defaultValue={defaults.categoryId ?? ""} name="categoryId" required>
              <option value="">Choose a category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field error={errors.locationId} hint="Choose the province if the job is in several cities." label="City">
            <select className={inputClass} defaultValue={defaults.locationId ?? ""} name="locationId" required>
              <option value="">Choose a city</option>
              {provinces.map((province) => (
                <optgroup key={province.id} label={province.name}>
                  <option value={province.id}>Anywhere in {province.name}</option>
                  {province.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Job type">
            <select className={inputClass} defaultValue={defaults.employmentType ?? "FULL_TIME"} name="employmentType">
              {employment.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Work arrangement">
            <select className={inputClass} defaultValue={defaults.workplaceType ?? "ONSITE"} name="workplaceType">
              <option value="ONSITE">On-site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
              <option value="NOT_SPECIFIED">Not specified</option>
            </select>
          </Field>
          <Field label="Experience">
            <select className={inputClass} defaultValue={defaults.experienceLevel ?? "NOT_SPECIFIED"} name="experienceLevel">
              {experience.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field error={errors.education} label="Education (optional)">
            <input className={inputClass} defaultValue={defaults.education} maxLength={191} name="education" placeholder="e.g. B.Com or ACCA" />
          </Field>
        </div>
      </Card>

      <Card title="Description">
        <div className="space-y-5">
          <Field error={errors.description} hint="What the role is, the team, and what makes it worth applying for." label="About the job">
            <textarea className={`${textareaClass} min-h-44`} defaultValue={defaults.description} name="description" required />
          </Field>
          <Field error={errors.responsibilities} hint="One per line." label="Responsibilities (optional)">
            <textarea className={textareaClass} defaultValue={defaults.responsibilities} name="responsibilities" />
          </Field>
          <Field error={errors.requirements} hint="One per line." label="Requirements (optional)">
            <textarea className={textareaClass} defaultValue={defaults.requirements} name="requirements" />
          </Field>
          <Field error={errors.skills} hint="Separate with commas, e.g. Excel, Tally, Urdu typing." label="Skills (optional)">
            <input className={inputClass} defaultValue={defaults.skills} maxLength={2_000} name="skills" />
          </Field>
        </div>
      </Card>

      <Card title="Salary">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field hint="Jobs that show pay get more applicants." label="Show salary">
            <select className={inputClass} name="salaryVisibility" onChange={(event) => setSalaryVisibility(event.target.value)} value={salaryVisibility}>
              <option value="RANGE">As a range</option>
              <option value="EXACT">Exact amount</option>
              <option value="NEGOTIABLE">Negotiable</option>
              <option value="HIDDEN">Don&apos;t show</option>
            </select>
          </Field>
          {salaryVisibility !== "HIDDEN" && salaryVisibility !== "NEGOTIABLE" ? (
            <>
              <Field error={errors.salaryMin} label={salaryVisibility === "EXACT" ? "Amount (PKR)" : "From (PKR)"}>
                <input className={inputClass} defaultValue={defaults.salaryMin} inputMode="numeric" min="0" name="salaryMin" step="500" type="number" />
              </Field>
              {salaryVisibility === "RANGE" ? (
                <Field error={errors.salaryMax} label="To (PKR)">
                  <input className={inputClass} defaultValue={defaults.salaryMax} inputMode="numeric" min="0" name="salaryMax" step="500" type="number" />
                </Field>
              ) : null}
              <Field label="Per">
                <select className={inputClass} defaultValue={defaults.salaryPeriod ?? "MONTH"} name="salaryPeriod">
                  <option value="MONTH">Month</option>
                  <option value="YEAR">Year</option>
                  <option value="WEEK">Week</option>
                  <option value="DAY">Day</option>
                  <option value="HOUR">Hour</option>
                </select>
              </Field>
            </>
          ) : null}
        </div>
      </Card>

      <Card title="Applications">
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">How should people apply?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["ON_SITE", "On JobDraftly", "Candidates send their CV here and you review them in Applicants."],
                ["EXTERNAL_URL", "On our own website", "Candidates are sent to your careers page or application form."],
              ].map(([value, title, text]) => (
                <label className={`flex cursor-pointer gap-3 rounded-md border p-3.5 ${method === value ? "border-ink bg-paper" : "border-line"}`} key={value}>
                  <input checked={method === value} className="mt-1" name="applicationMethod" onChange={() => setMethod(value)} type="radio" value={value} />
                  <span>
                    <span className="block text-sm font-medium text-ink">{title}</span>
                    <span className="block text-xs leading-5 text-muted">{text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {method === "EXTERNAL_URL" ? (
            <Field error={errors.applicationUrl} label="Application link">
              <input className={inputClass} defaultValue={defaults.applicationUrl} name="applicationUrl" placeholder="https://yourcompany.com/careers/accounts-officer" type="url" />
            </Field>
          ) : null}
          <Field error={errors.applicationDeadline} hint={`The job comes down automatically after this date (up to ${MAX_EMPLOYER_LISTING_DAYS} days from today).`} label="Last date to apply">
            <input className={`${inputClass} sm:max-w-56`} defaultValue={defaults.applicationDeadline} max={maxDate} min={minDate} name="applicationDeadline" required type="date" />
          </Field>
        </div>
      </Card>

      <Notice tone={goesLiveImmediately ? "success" : "info"}>
        {goesLiveImmediately
          ? "Your company is verified, so this job goes live as soon as you save it."
          : "JobDraftly checks jobs from new companies before they go live, usually within one working day. We'll publish it once it's approved."}
      </Notice>

      <div className="flex justify-end">
        <Submit label={submitLabel} pending={pending} />
      </div>
    </form>
  );
}
