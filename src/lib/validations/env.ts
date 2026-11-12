import { z } from "zod";

export const databaseUrlSchema = z
  .url("DATABASE_URL must be a valid URL")
  .refine((value) => value.startsWith("mysql://"), {
    message: "DATABASE_URL must use the mysql protocol",
  });
