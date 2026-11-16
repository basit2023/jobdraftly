import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(max, `Keep this under ${max.toLocaleString("en")} characters`).nullable(),
  );

const optionalMoney = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.replaceAll(",", "") : null),
  z.coerce.number().min(0).max(100_000_000).nullable(),
);

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Longest a company may keep a job open (from today). */
export const MAX_EMPLOYER_LISTING_DAYS = 90;

export const employerJobSchema = z
  .object({
    title: z.string().trim().min(3, "Enter the job title").max(191),
    categoryId: z.string().min(1, "Choose a category").max(30),
    locationId: z.string().min(1, "Choose a city").max(30),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "FREELANCE", "OTHER"]),
    experienceLevel: z.enum(["NOT_SPECIFIED", "ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE"]),
    workplaceType: z.enum(["NOT_SPECIFIED", "ONSITE", "HYBRID", "REMOTE"]),
    workplaceStreetAddress: optionalText(255),
    workplacePostalCode: optionalText(20),
    education: optionalText(191),
    description: z.string().trim().min(80, "Describe the job in at least 80 characters").max(50_000),
    responsibilities: optionalText(20_000),
    requirements: optionalText(20_000),
    skills: optionalText(2_000),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    salaryVisibility: z.enum(["HIDDEN", "RANGE", "EXACT", "NEGOTIABLE"]),
    salaryPeriod: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.enum(["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
    ),
    applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the last date to apply"),
    applicationMethod: z.enum(["ON_SITE", "EXTERNAL_URL"]),
    applicationUrl: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
      z.string().max(2_000).refine(isHttpUrl, "Enter a full link starting with https://").nullable(),
    ),
  })
  .superRefine((data, context) => {
    if (data.applicationMethod === "EXTERNAL_URL" && !data.applicationUrl) {
      context.addIssue({ code: "custom", path: ["applicationUrl"], message: "Enter the link where candidates apply" });
    }
    if (data.salaryMin !== null && data.salaryMax !== null && data.salaryMin > data.salaryMax) {
      context.addIssue({ code: "custom", path: ["salaryMax"], message: "Maximum must be at least the minimum" });
    }
    if (data.salaryVisibility !== "HIDDEN" && data.salaryVisibility !== "NEGOTIABLE" && data.salaryMin === null && data.salaryMax === null) {
      context.addIssue({ code: "custom", path: ["salaryMin"], message: "Enter a salary, or choose Hidden or Negotiable" });
    }
    if (data.salaryVisibility !== "HIDDEN" && data.salaryVisibility !== "NEGOTIABLE" && !data.salaryPeriod) {
      context.addIssue({ code: "custom", path: ["salaryPeriod"], message: "Choose whether the salary is hourly, daily, weekly, monthly or yearly" });
    }
  });

export type EmployerJobInput = z.infer<typeof employerJobSchema>;

export const applicationStatuses = ["NEW", "REVIEWING", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"] as const;

export const applicationStatusLabels: Record<(typeof applicationStatuses)[number], string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFERED: "Offer made",
  HIRED: "Hired",
  REJECTED: "Not selected",
};

export const companyProfileSchema = z.object({
  description: optionalText(5_000),
  websiteUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(500).refine(isHttpUrl, "Enter a full link starting with https://").nullable(),
  ),
  industry: optionalText(120),
  locationId: optionalText(30),
});

export const applicationFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  // Trim first: a pasted address often carries a trailing space.
  email: z.string().trim().toLowerCase().max(191).pipe(z.email("Enter a valid email address")),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^\+?[0-9][0-9 ()-]{6,}$/, "Enter a valid phone number, e.g. 0300 1234567"),
  city: optionalText(120),
  coverLetter: optionalText(5_000),
  consent: z.literal("on", { error: "Please confirm that the company may see your details" }),
});

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[] | undefined>;
  link?: string;
};

export const initialFormState: FormState = { success: false, message: "" };
