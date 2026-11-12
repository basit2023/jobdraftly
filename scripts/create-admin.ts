import { config } from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { createDatabaseAdapter } from "../src/lib/db/adapter";
import { initialAdminSchema } from "../src/lib/validations/admin-auth";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const input = initialAdminSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  const db = new PrismaClient({ adapter: createDatabaseAdapter() });

  try {
    const existing = await db.admin.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new Error("An administrator with ADMIN_EMAIL already exists; no data was changed.");
    }

    const passwordHash = await hash(input.password, 12);
    const admin = await db.admin.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      },
      select: { id: true, email: true, role: true },
    });

    console.log(`Created ${admin.role} administrator ${admin.email} (${admin.id}).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator setup failed.");
  process.exitCode = 1;
});
