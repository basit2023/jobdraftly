import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { databaseUrlSchema } from "@/lib/validations/env";

export function createDatabaseAdapter(
  databaseUrl = process.env.DATABASE_URL,
): PrismaMariaDb {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  return new PrismaMariaDb(databaseUrlSchema.parse(databaseUrl));
}
