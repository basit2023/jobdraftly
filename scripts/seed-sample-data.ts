/**
 * Adds clearly labelled sample jobs to a LOCAL database so the site and the
 * scheduler can be tested without real sources or API keys.
 *
 *   npm run sample:seed            → add (or refresh) the sample data
 *   npm run sample:seed -- --remove → delete every sample record
 *
 * Every sample company is named "… (Sample)" and has a slug starting with "sample-".
 * The jobs cover the states the scheduler must handle:
 *   - live jobs with future deadlines (should stay)
 *   - a job whose deadline passed and one whose expiry date passed (should expire)
 *   - a live job whose source advert was removed (should close)
 *   - a job waiting for review (must never be public)
 */
import { config } from "dotenv";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";
import { db as appDb } from "../src/lib/db";
import { createEmployerUser } from "../src/lib/services/employer-accounts";
import { createJobDeduplicationKey, createJobSlug, createSourceUrlHash } from "../src/lib/services/job-identity";
import { deletePrivateFile } from "../src/lib/storage/private-store";

config({ path: [".env.local", ".env"], quiet: true });
if (process.env.NODE_ENV === "production") throw new Error("Sample data must never be added to production.");

const db = new PrismaClient({ adapter: createDatabaseAdapter() });
const SOURCE_SLUG = "sample-data-development";
const DAY = 86_400_000;
const now = Date.now();
const daysFromNow = (days: number) => new Date(now + days * DAY);

type Expect = "live" | "expire" | "close" | "pending";

type SampleJob = {
  key: string;
  expect: Expect;
  title: string;
  company: string;
  city: string;
  category: string;
  employmentType: Prisma.JobCreateInput["employmentType"];
  experienceLevel: Prisma.JobCreateInput["experienceLevel"];
  workplaceType: Prisma.JobCreateInput["workplaceType"];
  salary?: [number, number];
  deadlineDays: number | null;
  expiresDays?: number;
  description: string;
  requirements: string;
  skills: string;
  featured?: boolean;
  /** Candidates apply on JobDraftly with their CV (shows the apply form). */
  onSite?: boolean;
};

/** Sample company logins: one verified (jobs go live at once), one not (jobs wait for approval). */
const SAMPLE_EMPLOYERS = [
  { company: "Indus Byte Software (Sample)", name: "Sara Ahmed", email: "owner@indusbyte.sample.test", verified: true },
  { company: "Karachi Textile Mills (Sample)", name: "Bilal Qureshi", email: "owner@karachitextile.sample.test", verified: false },
] as const;

const jobs: SampleJob[] = [
  {
    key: "frontend", expect: "live", featured: true, onSite: true,
    title: "Senior Frontend Developer (React)", company: "Indus Byte Software (Sample)", city: "Lahore",
    category: "Information Technology & Software", employmentType: "FULL_TIME", experienceLevel: "SENIOR", workplaceType: "HYBRID",
    salary: [350_000, 500_000], deadlineDays: 21,
    description: "Indus Byte is hiring a senior frontend developer to lead the web app for its logistics platform. You will build new features in React and TypeScript, review code, and work closely with designers and the API team.\n\nThe team works from the Gulberg office three days a week.",
    requirements: "4+ years building production React applications\nStrong TypeScript and CSS skills\nExperience with testing (Vitest or Jest)",
    skills: "React, TypeScript, Next.js, CSS, Testing",
  },
  {
    key: "accountant", expect: "live", onSite: true,
    title: "Accounts Officer", company: "Karachi Textile Mills (Sample)", city: "Karachi",
    category: "Accounting & Finance", employmentType: "FULL_TIME", experienceLevel: "MID_LEVEL", workplaceType: "ONSITE",
    salary: [120_000, 160_000], deadlineDays: 10,
    description: "Karachi Textile Mills needs an accounts officer to manage payables, monthly reconciliations and tax filings for its SITE area plant. You will report to the finance manager and prepare monthly reports.",
    requirements: "B.Com or ACCA (part qualified)\n2–3 years in accounts, ideally manufacturing\nGood command of Excel and an ERP system",
    skills: "Accounting, Excel, Tax, Reconciliation",
  },
  {
    key: "govt-assistant", expect: "live",
    title: "Assistant (BPS-15)", company: "Ministry of Planning — Sample Directorate (Sample)", city: "Islamabad",
    category: "Government & Public Sector", employmentType: "FULL_TIME", experienceLevel: "ENTRY_LEVEL", workplaceType: "ONSITE",
    deadlineDays: 14,
    description: "Applications are invited for the post of Assistant (BPS-15) on a regular basis. Selected candidates will handle office correspondence, filing and record keeping at the directorate in Islamabad.",
    requirements: "Bachelor's degree (second division)\nAge 18–30 years (relaxation as per government rules)\nComputer proficiency",
    skills: "MS Office, Record keeping, Drafting",
  },
  {
    key: "remote-support", expect: "live",
    title: "Customer Support Representative (Remote, Night Shift)", company: "Bolan Digital Services (Sample)", city: "Islamabad",
    category: "Customer Service", employmentType: "FULL_TIME", experienceLevel: "ENTRY_LEVEL", workplaceType: "REMOTE",
    salary: [80_000, 110_000], deadlineDays: null,
    description: "Bolan Digital supports US e-commerce clients by chat and email. You will answer customer questions, process returns and log issues. The role is fully remote on the US daytime shift.",
    requirements: "Fluent written English\nReliable internet and a quiet place to work\nAvailable for night shifts (Pakistan time)",
    skills: "Customer support, English, Zendesk",
  },
  {
    key: "intern", expect: "live",
    title: "Marketing Intern", company: "Hunza Valley Foods (Sample)", city: "Rawalpindi",
    category: "Internships & Graduate Programs", employmentType: "INTERNSHIP", experienceLevel: "ENTRY_LEVEL", workplaceType: "ONSITE",
    salary: [35_000, 35_000], deadlineDays: 7,
    description: "A three-month paid internship in the marketing team. You will help plan social media posts, run product sampling events and track campaign results.",
    requirements: "Final-year student or fresh graduate in marketing or business\nGood communication skills",
    skills: "Social media, Canva, Communication",
  },
  {
    key: "nurse", expect: "live",
    title: "Staff Nurse", company: "Peshawar City Hospital (Sample)", city: "Peshawar",
    category: "Healthcare & Medical", employmentType: "CONTRACT", experienceLevel: "JUNIOR", workplaceType: "ONSITE",
    salary: [90_000, 120_000], deadlineDays: 30,
    description: "Peshawar City Hospital is hiring staff nurses for its medical and surgical wards on a one-year renewable contract. Rotating shifts apply.",
    requirements: "BSc Nursing or Diploma in General Nursing\nValid PNC registration\n1 year of ward experience preferred",
    skills: "Patient care, Ward management",
  },
  // States the scheduler must change:
  {
    key: "past-deadline", expect: "expire",
    title: "Sales Executive", company: "Multan Agro Traders (Sample)", city: "Multan",
    category: "Sales & Business Development", employmentType: "FULL_TIME", experienceLevel: "JUNIOR", workplaceType: "ONSITE",
    deadlineDays: -3,
    description: "Field sales role covering dealers in South Punjab. This sample job's deadline has passed, so the scheduler should expire it.",
    requirements: "Bachelor's degree\nMotorbike and licence", skills: "Sales, Negotiation",
  },
  {
    key: "past-expiry", expect: "expire",
    title: "Data Entry Operator", company: "Faisalabad Logistics (Sample)", city: "Faisalabad",
    category: "Administration & Office Support", employmentType: "PART_TIME", experienceLevel: "ENTRY_LEVEL", workplaceType: "ONSITE",
    deadlineDays: null, expiresDays: -1,
    description: "Part-time data entry for a logistics company. This sample job has no deadline but its listing period has ended, so the scheduler should expire it.",
    requirements: "Typing speed of 35+ wpm", skills: "Data entry, Excel",
  },
  {
    key: "removed-at-source", expect: "close",
    title: "Civil Engineer (Site)", company: "Quetta Builders (Sample)", city: "Quetta",
    category: "Engineering", employmentType: "CONTRACT", experienceLevel: "MID_LEVEL", workplaceType: "ONSITE",
    salary: [200_000, 260_000], deadlineDays: 20,
    description: "Site engineer for a road project. This sample job's advert has been removed from its source, so the scheduler should close it.",
    requirements: "BSc Civil Engineering, PEC registered\n3 years of site experience", skills: "AutoCAD, Site supervision",
  },
  {
    key: "pending", expect: "pending",
    title: "Graphic Designer", company: "Sialkot Sports Co. (Sample)", city: "Sialkot",
    category: "Media & Creative", employmentType: "FREELANCE", experienceLevel: "NOT_SPECIFIED", workplaceType: "REMOTE",
    deadlineDays: 15,
    description: "An AI-drafted job that is waiting for an administrator's review. It must not appear on the public site until approved.",
    requirements: "Portfolio of print and social designs", skills: "Illustrator, Photoshop",
  },
];

async function remove() {
  const source = await db.jobSource.findUnique({ where: { slug: SOURCE_SLUG }, select: { id: true } });
  const jobIds = source ? (await db.job.findMany({ where: { sourceId: source.id }, select: { id: true } })).map((job) => job.id) : [];
  if (source) {
    await db.adminNotification.deleteMany({ where: { OR: [{ entityId: { in: jobIds } }, { entityId: source.id }] } });
    await db.auditLog.deleteMany({ where: { entityId: { in: jobIds } } });
    await db.sourceDiscovery.deleteMany({ where: { sourceId: source.id } });
    await db.job.deleteMany({ where: { sourceId: source.id } });
  }
  // Company logins and applications (with their private CV files) go before the companies.
  const sampleCompanies = { slug: { startsWith: "sample-" } };
  for (const application of await db.jobApplication.findMany({ where: { company: sampleCompanies }, select: { cvStorageKey: true } })) {
    await deletePrivateFile(application.cvStorageKey).catch(() => undefined);
  }
  await db.jobApplication.deleteMany({ where: { company: sampleCompanies } });
  await db.employerUser.deleteMany({ where: { company: sampleCompanies } });
  await db.job.deleteMany({ where: { company: sampleCompanies, postedByEmployerId: { not: null } } });
  await db.company.deleteMany({ where: { slug: { startsWith: "sample-" }, jobs: { none: {} } } });
  if (source) await db.jobSource.delete({ where: { id: source.id } });
  return jobIds.length;
}

async function seed() {
  await remove();
  const [categories, cities] = await Promise.all([
    db.jobCategory.findMany({ select: { id: true, name: true } }),
    db.jobLocation.findMany({ where: { type: "CITY" }, select: { id: true, name: true } }),
  ]);
  const byName = <T extends { name: string }>(items: T[], name: string) => {
    const found = items.find((item) => item.name === name);
    if (!found) throw new Error(`Reference data missing: ${name}`);
    return found;
  };

  const source = await db.jobSource.create({
    data: {
      name: "Sample data (development)", slug: SOURCE_SLUG, type: "MANUAL",
      permissionStatus: "APPROVED", approvedAt: new Date(), isActive: true,
      permissionNotes: "Fictional sample data created by scripts/seed-sample-data.ts for local testing.",
    },
  });

  for (const sample of jobs) {
    const city = byName(cities, sample.city);
    const category = byName(categories, sample.category);
    const companySlug = `sample-${sample.company.toLowerCase().replace(/\(sample\)/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const company = await db.company.upsert({
      where: { slug: companySlug },
      update: {},
      create: {
        name: sample.company, slug: companySlug, locationId: city.id, isActive: true,
        isVerified: SAMPLE_EMPLOYERS.some((employer) => employer.company === sample.company && employer.verified),
        description: "Fictional company used for local testing.",
      },
    });
    const sourceUrl = `https://example.com/sample-jobs/${sample.key}`;
    const deadline = sample.deadlineDays === null ? null : new Date(`${daysFromNow(sample.deadlineDays).toISOString().slice(0, 10)}T23:59:59+05:00`);
    const live = sample.expect !== "pending";
    const job = await db.job.create({
      data: {
        title: sample.title,
        slug: createJobSlug(sample.title, company.slug),
        companyId: company.id,
        categoryId: category.id,
        locationId: city.id,
        description: sample.description,
        requirements: sample.requirements,
        skills: sample.skills,
        employmentType: sample.employmentType,
        experienceLevel: sample.experienceLevel,
        workplaceType: sample.workplaceType,
        salaryMin: sample.salary?.[0] ?? null,
        salaryMax: sample.salary?.[1] ?? null,
        salaryVisibility: sample.salary ? (sample.salary[0] === sample.salary[1] ? "EXACT" : "RANGE") : "HIDDEN",
        salaryPeriod: sample.salary ? "MONTH" : null,
        applicationMethod: sample.onSite ? "ON_SITE" : "EXTERNAL_URL",
        applicationUrl: sample.onSite ? null : sourceUrl,
        sourceId: source.id,
        sourceUrl,
        sourceExternalId: sample.key,
        sourceUrlHash: createSourceUrlHash(sourceUrl),
        deduplicationKey: createJobDeduplicationKey({ title: sample.title, companyId: company.id, locationId: city.id, sourceId: source.id, sourceExternalId: sample.key }),
        originalPublishedAt: daysFromNow(-2),
        applicationDeadline: deadline,
        expiresAt: sample.expiresDays !== undefined ? daysFromNow(sample.expiresDays) : deadline ?? daysFromNow(30),
        status: live ? "PUBLISHED" : "PENDING_REVIEW",
        publishedAt: live ? daysFromNow(-2) : null,
        verificationStatus: live ? "VERIFIED" : "UNVERIFIED",
        verifiedAt: live ? daysFromNow(-2) : null,
        isFeatured: Boolean(sample.featured),
      },
    });

    if (sample.expect === "close") {
      // The source no longer lists this advert; syncJobsWithSources should close the job.
      await db.sourceDiscovery.create({
        data: {
          sourceId: source.id, relatedJobId: job.id, externalKey: `sample-${sample.key}`.padEnd(64, "0"),
          externalId: sample.key, canonicalUrl: sourceUrl, title: sample.title, type: "JOB",
          status: "REMOVED", latestChangeType: "REMOVED", fingerprint: "0".repeat(64),
          firstSeenAt: daysFromNow(-5), lastSeenAt: daysFromNow(-1), removedAt: new Date(), extractionStatus: "SUCCEEDED",
        },
      });
    }
    console.log(`${sample.expect.padEnd(8)} ${sample.title} — ${sample.city}  →  /jobs/${job.slug}${sample.onSite ? "  (apply on JobDraftly)" : ""}`);
  }

  console.log("");
  console.log("Sample company logins — open a link to choose a password, then sign in at /employer/login:");
  for (const employer of SAMPLE_EMPLOYERS) {
    const company = await db.company.findFirstOrThrow({ where: { name: employer.company }, select: { id: true } });
    const { link } = await createEmployerUser({ companyId: company.id, name: employer.name, email: employer.email, role: "OWNER" });
    console.log(`  ${employer.email} (${employer.verified ? "verified" : "not verified"})`);
    console.log(`    ${link.url}`);
  }
  await appDb.$disconnect();
}

const removing = process.argv.includes("--remove");
(removing ? remove().then((count) => console.log(`Removed ${count} sample job(s).`)) : seed())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
