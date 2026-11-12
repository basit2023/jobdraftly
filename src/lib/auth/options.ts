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
          role: admin.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = token.role ?? "EDITOR";
      }
      return session;
    },
  },
};
