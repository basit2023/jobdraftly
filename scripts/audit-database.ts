import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";

config({ path: [".env.local", ".env"], quiet: true });

const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

async function main() {
  const [
    categories,
    provinces,
    cities,
    sources,
    jobs,
    companies,
    admins,
    approvedSources,
    monitoredSources,
    operationalSources,
    monitorRuns,
    discoveries,
    notifications,
    checkConstraints,
  ] = await Promise.all([
    prisma.jobCategory.count(),
    prisma.jobLocation.count({ where: { type: "PROVINCE" } }),
    prisma.jobLocation.count({ where: { type: "CITY" } }),
    prisma.jobSource.count(),
    prisma.job.count(),
    prisma.company.count(),
    prisma.admin.count(),
    prisma.jobSource.count({ where: { permissionStatus: "APPROVED", isActive: true } }),
    prisma.jobSource.count({ where: { monitoringEnabled: true } }),
    prisma.jobSource.findMany({
      where: {
        monitoringEnabled: true,
        permissionStatus: "APPROVED",
        isActive: true,
        lastSuccessfulScanAt: { not: null },
        consecutiveFailures: 0,
      },
      select: { name: true, lastSuccessfulScanAt: true },
    }),
    prisma.sourceMonitorRun.count(),
    prisma.sourceDiscovery.count(),
    prisma.adminNotification.count(),
    prisma.$queryRaw<Array<{ salaryChecks: bigint }>>`
      SELECT COUNT(*) AS salaryChecks
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'jobs'
        AND CONSTRAINT_TYPE = 'CHECK'
    `,
  ]);

  console.log({
    categories,
    provinces,
    cities,
    sources,
    jobs,
    companies,
    admins,
    approvedSources,
    monitoredSources,
    operationalSources,
    monitorRuns,
    discoveries,
    notifications,
    salaryChecks: Number(checkConstraints[0]?.salaryChecks ?? 0),
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
