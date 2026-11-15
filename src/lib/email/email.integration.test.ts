import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { employerAccessEmail } from "./templates";

type Received = { from: string; to: string[]; raw: string };

/** A real SMTP server on localhost that requires a username and password, like Gmail does. */
function startSmtpServer(received: Received[]) {
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true, // plain connection on localhost only
    disabledCommands: ["STARTTLS"],
    logger: false,
    onAuth(auth, _session, callback) {
      if (auth.username === "mailer@jobdraftly.test" && auth.password === "correct-app-password") return callback(null, { user: auth.username });
      return callback(new Error("Invalid username or password"));
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
      stream.on("end", () => {
        received.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "", to: session.envelope.rcptTo.map((r) => r.address), raw });
        callback();
      });
    },
  });
  return new Promise<{ server: SMTPServer; port: number }>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.server.address() as AddressInfo).port }));
  });
}

/** Decodes a quoted-printable plain-text part enough to read links back out. */
function decodeQuotedPrintable(value: string) {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

describe("verification email template", () => {
  it("escapes names so a company called <script> can't inject HTML", () => {
    const email = employerAccessEmail({
      to: "a@example.com",
      name: `<img src=x onerror=alert(1)>`,
      companyName: `Evil & "Co" <script>`,
      url: "http://localhost:3000/employer/setup?token=abc",
      expiresAt: new Date("2026-11-20T10:00:00Z"),
      kind: "welcome",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.subject).toBe(`Verify your email to access Evil & "Co" <script> on JobDraftly`);
    expect(email.text).toContain("http://localhost:3000/employer/setup?token=abc");
  });

  it("words a reset differently from a welcome", () => {
    const reset = employerAccessEmail({ to: "a@example.com", name: "Ali", companyName: "Acme", url: "http://x/y", expiresAt: new Date(), kind: "reset" });
    expect(reset.subject).toBe("Reset your JobDraftly password");
    expect(reset.text).toContain("your current password still works");
  });
});

const runDatabaseTests = Boolean(process.env.DATABASE_URL);

describe.runIf(runDatabaseTests)("sending login verification emails over SMTP", async () => {
  const received: Received[] = [];
  const { server, port } = await startSmtpServer(received);
  const { db } = await import("@/lib/db");
  const accounts = await import("@/lib/services/employer-accounts");
  const { sendEmail } = await import("./mailer");
  const suffix = randomUUID().slice(0, 8);
  let companyId = "";

  const useSmtp = (password: string) => {
    vi.stubEnv("SMTP_HOST", "127.0.0.1");
    vi.stubEnv("SMTP_PORT", String(port));
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USER", "mailer@jobdraftly.test");
    vi.stubEnv("SMTP_PASSWORD", password);
    vi.stubEnv("MAIL_FROM", "JobDraftly <fastsitecheck@gmail.com>");
  };

  beforeAll(async () => {
    companyId = (await db.company.create({ data: { name: `Email Test Co ${suffix}`, slug: `email-test-${suffix}`, isActive: true } })).id;
  });
  beforeEach(() => {
    received.length = 0;
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await db.employerUser.deleteMany({ where: { companyId } });
    await db.company.delete({ where: { id: companyId } });
    await db.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("emails the owner a link that verifies the account", async () => {
    useSmtp("correct-app-password");
    const email = `owner-${suffix}@example.com`;
    const { user, link } = await accounts.createEmployerUser({ companyId, name: "Owner Test", email, role: "OWNER" });

    const result = await accounts.emailSetupLink(user.id, link, "welcome");
    expect(result).toEqual({ delivered: "smtp" });
    expect(received).toHaveLength(1);
    expect(received[0].to).toEqual([email]);
    expect(received[0].from).toBe("fastsitecheck@gmail.com");
    expect(received[0].raw).toMatch(/Subject: Verify your email to access Email Test Co/);

    // Take the link out of the email exactly as the person would click it.
    const body = decodeQuotedPrintable(received[0].raw);
    const url = body.match(/https?:\/\/[^\s"<]+\/employer\/setup\?token=[A-Za-z0-9_-]+/)?.[0];
    expect(url).toBeDefined();
    const token = new URL(url!).searchParams.get("token")!;
    expect(await accounts.findValidSetupToken(token)).toMatchObject({ email });

    await accounts.completeEmployerSetup(token, "Verified-pass-123");
    expect((await db.employerUser.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBeTruthy();
    expect(accounts.describeDelivery(result, email, url!)).toEqual({
      message: `We emailed a verification link to ${email}. It works once and expires in 72 hours.`,
      link: undefined,
    });
  });

  it("reports a wrong SMTP password and falls back to showing the link", async () => {
    useSmtp("wrong-password");
    const result = await sendEmail({ to: "x@example.com", subject: "Test", text: "Test", html: "<p>Test</p>" });
    expect(result.delivered).toBe(false);
    expect(received).toHaveLength(0);
    const shown = accounts.describeDelivery(result, "x@example.com", "http://localhost:3000/employer/setup?token=t");
    expect(shown.link).toBe("http://localhost:3000/employer/setup?token=t");
    expect(shown.message).toMatch(/could not be sent/);
  });

  it("saves the email to storage/dev-outbox when SMTP isn't set up in development", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("NODE_ENV", "development");
    const result = await sendEmail({ to: "dev@example.com", subject: "Dev test", text: "Dev", html: "<p>Hello dev</p>" });
    expect(result.delivered).toBe("dev-outbox");
    if (result.delivered !== "dev-outbox") return;
    expect(result.file).toMatch(/^storage[\\/]dev-outbox[\\/].+\.html$/);
    const file = path.join(process.cwd(), result.file);
    expect(await readFile(file, "utf8")).toContain("<p>Hello dev</p>");
    await rm(file);
  });

  it("refuses to pretend in production when SMTP isn't set up", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("NODE_ENV", "production");
    const result = await sendEmail({ to: "prod@example.com", subject: "Prod test", text: "x", html: "x" });
    expect(result).toEqual({ delivered: false, reason: expect.stringMatching(/isn't set up/) });
  });
});
