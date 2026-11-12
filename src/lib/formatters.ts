import type {
  EmploymentType,
  ExperienceLevel,
  SalaryPeriod,
  SalaryVisibility,
  WorkplaceType,
} from "@/generated/prisma/client";

const employmentLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
  OTHER: "Other",
};

const experienceLabels: Record<ExperienceLevel, string> = {
  NOT_SPECIFIED: "Not specified",
  ENTRY_LEVEL: "Entry level",
  JUNIOR: "Junior",
  MID_LEVEL: "Mid level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  DIRECTOR: "Director",
  EXECUTIVE: "Executive",
};

const workplaceLabels: Record<WorkplaceType, string> = {
  NOT_SPECIFIED: "Not specified",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export function employmentTypeLabel(value: EmploymentType): string {
  return employmentLabels[value];
}

export function experienceLevelLabel(value: ExperienceLevel): string {
  return experienceLabels[value];
}

export function workplaceTypeLabel(value: WorkplaceType): string {
  return workplaceLabels[value];
}

export function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

export function formatRelativeDate(value: Date | null | undefined): string {
  if (!value) return "Recently added";
  const days = Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return formatDate(value) ?? "Recently added";
}

type SalaryInput = {
  salaryMin: { toNumber(): number } | null;
  salaryMax: { toNumber(): number } | null;
  salaryCurrency: string;
  salaryVisibility: SalaryVisibility;
  salaryPeriod?: SalaryPeriod | null;
};

export function formatSalary(job: SalaryInput): string | null {
  if (job.salaryVisibility === "HIDDEN") return null;
  if (job.salaryVisibility === "NEGOTIABLE") return "Salary negotiable";
  const formatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
  const minimum = job.salaryMin?.toNumber();
  const maximum = job.salaryMax?.toNumber();
  const prefix = job.salaryCurrency === "PKR" ? "PKR" : job.salaryCurrency;
  const period = job.salaryPeriod ? ` per ${job.salaryPeriod.toLocaleLowerCase("en")}` : "";
  if (minimum !== undefined && maximum !== undefined) return `${prefix} ${formatter.format(minimum)}–${formatter.format(maximum)}${period}`;
  if (minimum !== undefined) return `${prefix} ${formatter.format(minimum)}+${period}`;
  if (maximum !== undefined) return `Up to ${prefix} ${formatter.format(maximum)}${period}`;
  return null;
}

export function splitList(value: string | null | undefined): string[] {
  return value ? value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 20) : [];
}
