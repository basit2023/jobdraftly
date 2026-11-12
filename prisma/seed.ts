import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";

config({ path: [".env.local", ".env"], quiet: true });

const categories = [
  ["Information Technology & Software", "information-technology-software"],
  ["Engineering", "engineering"],
  ["Accounting & Finance", "accounting-finance"],
  ["Banking & Financial Services", "banking-financial-services"],
  ["Sales & Business Development", "sales-business-development"],
  ["Marketing & Communications", "marketing-communications"],
  ["Human Resources", "human-resources"],
  ["Administration & Office Support", "administration-office-support"],
  ["Customer Service", "customer-service"],
  ["Healthcare & Medical", "healthcare-medical"],
  ["Education & Training", "education-training"],
  ["Government & Public Sector", "government-public-sector"],
  ["Legal", "legal"],
  ["Manufacturing & Operations", "manufacturing-operations"],
  ["Supply Chain & Logistics", "supply-chain-logistics"],
  ["Construction & Real Estate", "construction-real-estate"],
  ["Hospitality & Tourism", "hospitality-tourism"],
  ["Media & Creative", "media-creative"],
  ["Telecommunications", "telecommunications"],
  ["Nonprofit & Development", "nonprofit-development"],
  ["Agriculture & Livestock", "agriculture-livestock"],
  ["Security & Law Enforcement", "security-law-enforcement"],
  ["Internships & Graduate Programs", "internships-graduate-programs"],
  ["Other", "other"],
] as const;

const locations = [
  {
    name: "Islamabad Capital Territory",
    slug: "islamabad-capital-territory",
    cities: [["Islamabad", "islamabad"]],
  },
  {
    name: "Punjab",
    slug: "punjab",
    cities: [
      ["Lahore", "lahore"],
      ["Rawalpindi", "rawalpindi"],
      ["Faisalabad", "faisalabad"],
      ["Multan", "multan"],
      ["Gujranwala", "gujranwala"],
      ["Sialkot", "sialkot"],
      ["Bahawalpur", "bahawalpur"],
      ["Sargodha", "sargodha"],
      ["Sheikhupura", "sheikhupura"],
      ["Gujrat", "gujrat"],
      ["Jhelum", "jhelum"],
      ["Sahiwal", "sahiwal"],
      ["Rahim Yar Khan", "rahim-yar-khan"],
      ["Dera Ghazi Khan", "dera-ghazi-khan"],
    ],
  },
  {
    name: "Sindh",
    slug: "sindh",
    cities: [
      ["Karachi", "karachi"],
      ["Hyderabad", "hyderabad"],
      ["Sukkur", "sukkur"],
      ["Larkana", "larkana"],
      ["Mirpur Khas", "mirpur-khas"],
      ["Nawabshah", "nawabshah"],
      ["Thatta", "thatta"],
    ],
  },
  {
    name: "Khyber Pakhtunkhwa",
    slug: "khyber-pakhtunkhwa",
    cities: [
      ["Peshawar", "peshawar"],
      ["Abbottabad", "abbottabad"],
      ["Mardan", "mardan"],
      ["Mingora", "mingora"],
      ["Kohat", "kohat"],
      ["Nowshera", "nowshera"],
      ["Dera Ismail Khan", "dera-ismail-khan"],
      ["Mansehra", "mansehra"],
      ["Bannu", "bannu"],
      ["Haripur", "haripur"],
    ],
  },
  {
    name: "Balochistan",
    slug: "balochistan",
    cities: [
      ["Quetta", "quetta"],
      ["Gwadar", "gwadar"],
      ["Turbat", "turbat"],
      ["Khuzdar", "khuzdar"],
      ["Chaman", "chaman"],
      ["Hub", "hub"],
    ],
  },
  {
    name: "Gilgit-Baltistan",
    slug: "gilgit-baltistan",
    cities: [
      ["Gilgit", "gilgit"],
      ["Skardu", "skardu"],
      ["Hunza", "hunza"],
      ["Chilas", "chilas"],
    ],
  },
  {
    name: "Azad Jammu and Kashmir",
    slug: "azad-jammu-and-kashmir",
    cities: [
      ["Muzaffarabad", "muzaffarabad"],
      ["Mirpur", "mirpur-ajk"],
      ["Kotli", "kotli"],
      ["Bagh", "bagh"],
      ["Rawalakot", "rawalakot"],
    ],
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed is disabled in production");
  }

  const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

  try {
    await prisma.$transaction(
      categories.map(([name, slug], sortOrder) =>
        prisma.jobCategory.upsert({
          where: { slug },
          update: { name, sortOrder, isActive: true },
          create: { name, slug, sortOrder, isActive: true },
        }),
      ),
    );

    for (const [provinceOrder, location] of locations.entries()) {
      const province = await prisma.jobLocation.upsert({
        where: { slug: location.slug },
        update: {
          name: location.name,
          type: "PROVINCE",
          sortOrder: provinceOrder,
          isActive: true,
        },
        create: {
          name: location.name,
          slug: location.slug,
          type: "PROVINCE",
          sortOrder: provinceOrder,
          isActive: true,
        },
      });

      await prisma.$transaction(
        location.cities.map(([name, slug], cityOrder) =>
          prisma.jobLocation.upsert({
            where: { slug },
            update: {
              name,
              type: "CITY",
              provinceId: province.id,
              sortOrder: cityOrder,
              isActive: true,
            },
            create: {
              name,
              slug,
              type: "CITY",
              provinceId: province.id,
              sortOrder: cityOrder,
              isActive: true,
            },
          }),
        ),
      );
    }

    await prisma.jobSource.upsert({
      where: { slug: "jobdraftly-manual" },
      update: {
        name: "JobDraftly Manual Entry",
        isActive: true,
        permissionStatus: "APPROVED",
        approvedAt: new Date(),
      },
      create: {
        name: "JobDraftly Manual Entry",
        slug: "jobdraftly-manual",
        type: "MANUAL",
        baseUrl: "https://www.jobdraftly.com",
        permissionStatus: "APPROVED",
        approvedAt: new Date(),
        isActive: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
