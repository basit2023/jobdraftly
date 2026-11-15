import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/observability/logger";

/*
 * Outgoing email over SMTP (Gmail with an app password, Hostinger, Zoho, cPanel mail,
 * Amazon SES SMTP, …). Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and
 * optionally MAIL_FROM. Without SMTP:
 *   - development: the email is saved to storage/dev-outbox/ so you can open it;
 *   - production: nothing is sent and the caller is told, so it can show the link instead.
 */

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type EmailResult =
  | { delivered: "smtp" }
  | { delivered: "dev-outbox"; file: string }
  | { delivered: false; reason: string };

function smtpSettings() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host,
    port,
    // Port 465 uses TLS from the start; 587/25 upgrade with STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass },
    from: process.env.MAIL_FROM?.trim() || `JobDraftly <${user}>`,
  };
}

export function emailIsConfigured() {
  return Boolean(smtpSettings());
}

let cached: { key: string; transporter: Transporter } | null = null;

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const settings = smtpSettings();

  if (!settings) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("email.not_configured", { subject: message.subject });
      return { delivered: false, reason: "Email sending isn't set up on the server (SMTP settings are missing)." };
    }
    // Development: keep a copy you can open in the browser.
    const directory = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "dev-outbox");
    const file = path.join(/*turbopackIgnore: true*/ directory, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.html`);
    await mkdir(/*turbopackIgnore: true*/ directory, { recursive: true });
    await writeFile(
      /*turbopackIgnore: true*/ file,
      `<!-- To: ${message.to} | Subject: ${message.subject} -->\n${message.html}`,
      "utf8",
    );
    logger.info("email.saved_to_dev_outbox", { to: message.to, subject: message.subject, file });
    return { delivered: "dev-outbox", file: path.relative(process.cwd(), file) };
  }

  try {
    // Rebuild the connection if the SMTP settings changed (e.g. a corrected password).
    const key = JSON.stringify([settings.host, settings.port, settings.secure, settings.auth.user, settings.auth.pass]);
    if (cached?.key !== key) {
      cached = {
        key,
        transporter: nodemailer.createTransport({
          host: settings.host,
          port: settings.port,
          secure: settings.secure,
          auth: settings.auth,
          connectionTimeout: 15_000,
          greetingTimeout: 15_000,
          socketTimeout: 30_000,
          // Local test servers have no certificate; real providers always do.
          ...(process.env.SMTP_ALLOW_INSECURE_TLS === "true" ? { tls: { rejectUnauthorized: false } } : {}),
        }),
      };
    }
    await cached.transporter.sendMail({ from: settings.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    logger.info("email.sent", { subject: message.subject });
    return { delivered: "smtp" };
  } catch (error) {
    // Never log the recipient's message body; the error explains the SMTP problem.
    logger.error("email.send_failed", { subject: message.subject, error });
    return { delivered: false, reason: "The email server refused the message. Check the SMTP settings." };
  }
}
