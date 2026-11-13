/**
 * Loads categories, provinces and cities. Safe on production and safe to re-run:
 * it only adds missing rows and refreshes names/order.
 *
 *   npm run db:reference-data
 */
import { config } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";
import { loadReferenceData } from "../src/lib/reference-data/load";

config({ path: [".env.local", ".env"], quiet: true });

const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

loadReferenceData(prisma)
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
