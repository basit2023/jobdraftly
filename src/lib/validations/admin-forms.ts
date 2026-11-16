import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(max).nullable(),
  );

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine(isHttpUrl, "Use an HTTP or HTTPS URL");

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  httpUrl.nullable(),
);

const optionalLogoUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z
    .string()
    .refine(
      (value) =>
        /^\/uploads\/company-logos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i.test(value) ||
        httpUrl.safeParse(value).success,
      "Upload a logo or enter a valid HTTP or HTTPS URL",
    )
    .nullable(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value ? value : null),
  z.coerce.date().nullable(),
);

const optionalMoney = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.coerce.number().min(0).max(100_000_000).nullable(),
);

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const jobAdminSchema = z
  .object({
    title: z.string().trim().min(3).max(191),
    companyId: z.string().min(1, "Select a company").max(30),
    categoryId: z.string().min(1, "Select a category").max(30),
    locationId: z.string().min(1, "Select a location").max(30),
    description: z.string().trim().min(20, "Description must contain at least 20 characters"),
    responsibilities: optionalText(50_000),
    requirements: optionalText(50_000),
    skills: optionalText(10_000),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "FREELANCE", "OTHER"]),
    experienceLevel: z.enum(["NOT_SPECIFIED", "ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD", "MANAGER", "DIRECTOR", "EXECUTIVE"]),
    education: optionalText(191),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    salaryCurrency: z.string().trim().toUpperCase().length(3).default("PKR"),
    salaryVisibility: z.enum(["HIDDEN", "RANGE", "EXACT", "NEGOTIABLE"]),
    salaryPeriod: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.enum(["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
    ),
    workplaceType: z.enum(["NOT_SPECIFIED", "ONSITE", "HYBRID", "REMOTE"]),
    workplaceStreetAddress: optionalText(255),
    workplacePostalCode: optionalText(20),
    applicationMethod: z.enum(["EXTERNAL_URL", "EMAIL", "INSTRUCTIONS", "ON_SITE"]),
    applicationUrl: optionalUrl,
    sourceId: optionalText(30),
    sourceUrl: optionalUrl,
    status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "EXPIRED", "CLOSED"]),
    applicationDeadline: optionalDate,
    expiresAt: optionalDate,
    isFeatured: checkbox,
  })
  .superRefine((data, context) => {
    if (data.applicationMethod === "EXTERNAL_URL" && !data.applicationUrl) {
      context.addIssue({ code: "custom", path: ["applicationUrl"], message: "A verified application URL is required" });
    }
    if (data.salaryMin !== null && data.salaryMax !== null && data.salaryMin > data.salaryMax) {
      context.addIssue({ code: "custom", path: ["salaryMax"], message: "Maximum salary must be greater than or equal to minimum salary" });
    }
    if (["RANGE", "EXACT"].includes(data.salaryVisibility) && data.salaryMin === null && data.salaryMax === null) {
      context.addIssue({ code: "custom", path: ["salaryMin"], message: "Enter the employer-provided salary amount" });
    }
    if (["RANGE", "EXACT"].includes(data.salaryVisibility) && !data.salaryPeriod) {
      context.addIssue({ code: "custom", path: ["salaryPeriod"], message: "Select the salary period stated by the employer" });
    }
    if (data.applicationDeadline && data.expiresAt && data.expiresAt < data.applicationDeadline) {
      context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiration cannot be before the application deadline" });
    }
  });

export const companyAdminSchema = z.object({
  name: z.string().trim().min(2).max(191),
  legalName: optionalText(191),
  websiteUrl: optionalUrl,
  domain: optionalText(191),
  logoUrl: optionalLogoUrl,
  description: optionalText(50_000),
  industry: optionalText(120),
  locationId: optionalText(30),
  isVerified: checkbox,
  isActive: checkbox,
});

export const categoryAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(2_000),
  parentId: optionalText(30),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const locationAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    type: z.enum(["PROVINCE", "CITY"]),
    provinceId: optionalText(30),
    sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .superRefine((data, context) => {
    if (data.type === "CITY" && !data.provinceId) {
      context.addIssue({ code: "custom", path: ["provinceId"], message: "Select a province for a city" });
    }
  });

export const sourceAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["MANUAL", "CSV", "XML_FEED", "API", "EMPLOYER_WEBSITE", "JOB_BOARD", "GOVERNMENT_PORTAL"]),
  baseUrl: optionalUrl,
  termsUrl: optionalUrl,
  feedUrl: optionalUrl,
  attributionText: optionalText(255),
  permissionNotes: optionalText(2_000),
});

export const sourceMonitoringSchema = z.object({
  monitoringMode: z.enum(["DISABLED", "API", "RSS", "WEB_PAGE"]),
  monitoringEnabled: checkbox,
  monitoringIntervalMinutes: z.coerce.number().int().min(5).max(43_200),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(60),
  autoPublish: checkbox,
});

export type AdminFormState = {
  message: string;
  success: boolean;
  errors?: Record<string, string[]>;
};

export const initialAdminFormState: AdminFormState = { message: "", success: false };
