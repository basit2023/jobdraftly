import "server-only";

import { compare, hashSync } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/security/request";
import { adminLoginSchema } from "@/lib/validations/admin-auth";

const dummyPasswordHash = hashSync("jobdraftly-invalid-password", 12);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Administrator credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = adminLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const loginLimit = await rateLimit(
          `admin-login:${requestIp(request.headers)}:${parsed.data.email.toLowerCase()}`,
          5,
          15 * 60_000,
        );
        if (!loginLimit.allowed) return null;

        const admin = await db.admin.findUnique({
          where: { email: parsed.data.email },
        });
        const passwordMatches = await compare(
          parsed.data.password,
          admin?.passwordHash ?? dummyPasswordHash,
        );

        if (!admin || !admin.isActive || !passwordMatches) return null;

        await db.$transaction([
          db.admin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
          }),
          db.auditLog.create({
            data: {
              adminId: admin.id,
              action: "LOGIN",
              entityType: "Admin",
              entityId: admin.id,
              summary: "Administrator signed in",
            },
          }),
        ]);

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          kind: "admin" as const,
          role: admin.role,
        };
      },
    }),
    CredentialsProvider({
      id: "employer-credentials",
      name: "Employer credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = adminLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const loginLimit = await rateLimit(
          `employer-login:${requestIp(request.headers)}:${parsed.data.email}`,
          5,
          15 * 60_000,
        );
        if (!loginLimit.allowed) return null;

        const employer = await db.employerUser.findUnique({
          where: { email: parsed.data.email },
          include: { company: { select: { isActive: true } } },
        });
        // Always run bcrypt so response time doesn't reveal whether the email exists.
        const passwordMatches = await compare(
          parsed.data.password,
          employer?.passwordHash ?? dummyPasswordHash,
        );
        if (!employer || !employer.passwordHash || !employer.isActive || !employer.company.isActive || !passwordMatches) {
          return null;
        }

        await db.employerUser.update({ where: { id: employer.id }, data: { lastLoginAt: new Date() } });
        return {
          id: employer.id,
          email: employer.email,
          name: employer.name,
          kind: "employer" as const,
          role: employer.role,
          companyId: employer.companyId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.kind = user.kind;
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        // Tokens issued before employer accounts existed were always administrators.
        session.user.kind = token.kind ?? "admin";
        session.user.role = token.role ?? "EDITOR";
        session.user.companyId = token.companyId;
      }
      return session;
    },
  },
};
