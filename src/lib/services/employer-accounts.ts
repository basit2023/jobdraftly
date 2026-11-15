import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { hash } from "bcryptjs";
import { z } from "zod";

import type { EmployerRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendEmail, type EmailResult } from "@/lib/email/mailer";
import { employerAccessEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/seo/site";

/** How long a setup / password-reset link stays valid. */
export const SETUP_LINK_HOURS = 72;

export const employerPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const employerMemberSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name").max(120),
  email: z.string().trim().toLowerCase().max(191).pipe(z.email("Enter a valid email address")),
});

export function hashSetupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a fresh one-time link for a user (first-time setup or a password reset).
 * Any earlier link stops working. Only the token's hash is stored.
 */
export async function issueSetupLink(userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SETUP_LINK_HOURS * 3_600_000);
  await db.employerUser.update({
    where: { id: userId },
    data: { setupTokenHash: hashSetupToken(token), setupTokenExpiresAt: expiresAt },
  });
  return { url: new URL(`/employer/setup?token=${token}`, appBaseUrl()).toString(), expiresAt };
}

/**
 * Where people open their setup link. Production always uses the canonical HTTPS site;
 * in development the local address (e.g. http://localhost:3000) is used so links work.
 */
function appBaseUrl() {
  if (process.env.NODE_ENV === "production") return absoluteUrl("/");
  for (const value of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL]) {
    try {
      if (value?.trim()) return new URL(value.trim()).origin;
    } catch {
      // Ignore malformed values and fall back.
    }
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

export class EmployerAccountError extends Error {}

/** Adds a login to a company and returns the one-time setup link to hand to that person. */
export async function createEmployerUser(input: { companyId: string; name: string; email: string; role: EmployerRole }) {
  const parsed = employerMemberSchema.parse(input);
  const existing = await db.employerUser.findUnique({ where: { email: parsed.email }, select: { companyId: true } });
  if (existing) {
    throw new EmployerAccountError(
      existing.companyId === input.companyId
        ? "This person already has a login for this company."
        : "This email already has a login for another company.",
    );
  }
  const user = await db.employerUser.create({
    data: { companyId: input.companyId, name: parsed.name, email: parsed.email, role: input.role, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });
  return { user, link: await issueSetupLink(user.id) };
}

/** Looks up a still-valid setup token. Returns null for unknown, used or expired links. */
export async function findValidSetupToken(token: string, now = new Date()) {
  if (!token || token.length > 100) return null;
  return db.employerUser.findFirst({
    where: {
      setupTokenHash: hashSetupToken(token),
      setupTokenExpiresAt: { gt: now },
      isActive: true,
      company: { isActive: true },
    },
    select: { id: true, name: true, email: true, company: { select: { name: true } } },
  });
}

/** Sets the password from a setup link and burns the link so it can't be reused. */
export async function completeEmployerSetup(token: string, password: string, now = new Date()) {
  const user = await findValidSetupToken(token, now);
  if (!user) throw new EmployerAccountError("This link has expired or was already used. Ask for a new one.");
  const passwordHash = await hash(employerPasswordSchema.parse(password), 12);
  await db.employerUser.update({
    where: { id: user.id },
    data: { passwordHash, setupTokenHash: null, setupTokenExpiresAt: null },
  });
  return user;
}

/**
 * Emails a one-time link to the person. Opening it verifies their email address
 * (only someone with access to that inbox can use it) and lets them set a password.
 */
export async function emailSetupLink(
  userId: string,
  link: { url: string; expiresAt: Date },
  kind: "welcome" | "reset",
  invitedBy?: string,
): Promise<EmailResult> {
  const user = await db.employerUser.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, company: { select: { name: true } } },
  });
  return sendEmail(
    employerAccessEmail({ to: user.email, name: user.name, companyName: user.company.name, url: link.url, expiresAt: link.expiresAt, kind, invitedBy }),
  );
}

/**
 * What to tell the person who created the login. The link itself is only shown on
 * screen when the email did not go out, so it can still be passed on by hand.
 */
export function describeDelivery(result: EmailResult, email: string, linkUrl: string) {
  if (result.delivered === "smtp") {
    return { message: `We emailed a verification link to ${email}. It works once and expires in ${SETUP_LINK_HOURS} hours.`, link: undefined };
  }
  if (result.delivered === "dev-outbox") {
    return {
      message: `Email isn't set up on this computer, so the email to ${email} was saved to ${result.file} instead. To test, open the link below:`,
      link: linkUrl,
    };
  }
  return { message: `The login was created, but the email to ${email} could not be sent. ${result.reason} Send them this link yourself:`, link: linkUrl };
}
