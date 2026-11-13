import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";
import { loadReferenceData } from "../src/lib/reference-data/load";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed is disabled in production");
  }

  const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

  try {
    console.log("Reference data:", await loadReferenceData(prisma));

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
