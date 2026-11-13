import type { PrismaClient } from "../../generated/prisma/client";

import { JOB_CATEGORIES, PROVINCES } from "./locations";

/**
 * Creates or updates categories, provinces and cities. Safe to run any number
 * of times, including on production: it only inserts missing rows and refreshes
 * names/order. It never deletes or deactivates anything an admin changed.
 */
export async function loadReferenceData(prisma: PrismaClient) {
  let categories = 0;
  let provinces = 0;
  let cities = 0;

  await prisma.$transaction(
    JOB_CATEGORIES.map(([name, slug], sortOrder) =>
      prisma.jobCategory.upsert({
        where: { slug },
        update: { name, sortOrder },
        create: { name, slug, sortOrder, isActive: true },
      }),
    ),
  );
  categories = JOB_CATEGORIES.length;

  for (const [provinceOrder, location] of PROVINCES.entries()) {
    const province = await prisma.jobLocation.upsert({
      where: { slug: location.slug },
      update: { name: location.name, type: "PROVINCE", sortOrder: provinceOrder },
      create: { name: location.name, slug: location.slug, type: "PROVINCE", sortOrder: provinceOrder, isActive: true },
    });
    provinces++;

    await prisma.$transaction(
      location.cities.map(([name, slug], cityOrder) =>
        prisma.jobLocation.upsert({
          where: { slug },
          update: { name, type: "CITY", provinceId: province.id, sortOrder: cityOrder },
          create: { name, slug, type: "CITY", provinceId: province.id, sortOrder: cityOrder, isActive: true },
        }),
      ),
    );
    cities += location.cities.length;
  }

  return { categories, provinces, cities };
}
