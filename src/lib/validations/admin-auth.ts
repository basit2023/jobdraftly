import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password").max(200),
});

export const initialAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(12, "ADMIN_PASSWORD must contain at least 12 characters")
    .max(200)
    .regex(/[a-z]/, "ADMIN_PASSWORD must include a lowercase letter")
    .regex(/[A-Z]/, "ADMIN_PASSWORD must include an uppercase letter")
    .regex(/[0-9]/, "ADMIN_PASSWORD must include a number")
    .regex(/[^A-Za-z0-9]/, "ADMIN_PASSWORD must include a symbol"),
});
