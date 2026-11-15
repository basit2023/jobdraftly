import type { EmailMessage } from "./mailer";

function escape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function expiryText(expiresAt: Date) {
  return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }).format(expiresAt);
}

/**
 * The email a company user receives with their one-time link. Opening it verifies
 * their email address and lets them choose a password.
 */
export function employerAccessEmail(input: {
  to: string;
  name: string;
  companyName: string;
  url: string;
  expiresAt: Date;
  kind: "welcome" | "reset";
  invitedBy?: string;
}): EmailMessage {
  const welcome = input.kind === "welcome";
  const subject = welcome
    ? `Verify your email to access ${input.companyName} on JobDraftly`
    : `Reset your JobDraftly password`;
  const intro = welcome
    ? `${input.invitedBy ? `${input.invitedBy} has` : "JobDraftly has"} created a login for you to manage ${input.companyName}'s jobs and applicants on JobDraftly.`
    : `Someone asked for a new password for your ${input.companyName} login on JobDraftly.`;
  const action = welcome ? "Verify email and set password" : "Choose a new password";
  const expires = expiryText(input.expiresAt);
  const ignore = welcome
    ? "If you weren't expecting this, you can ignore this email."
    : "If you didn't ask for this, ignore this email — your current password still works.";

  const text = [
    `Hi ${input.name},`,
    "",
    intro,
    "",
    `${action}: ${input.url}`,
    "",
    `This link works once and expires on ${expires} (Pakistan time).`,
    ignore,
    "",
    "— JobDraftly",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f8f7f4;font-family:Arial,Helvetica,sans-serif;color:#14171f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e3dd;border-radius:8px">
        <tr><td style="padding:28px 28px 8px">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#0b6e4f;font-weight:bold">JobDraftly for employers</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escape(welcome ? "Verify your email" : "Reset your password")}</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${escape(input.name)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3d4452">${escape(intro)}</p>
          <p style="margin:0 0 24px"><a href="${escape(input.url)}" style="display:inline-block;background:#14171f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:6px">${escape(action)}</a></p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7280">This link works once and expires on ${escape(expires)} (Pakistan time). ${escape(ignore)}</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all">If the button doesn't work, copy this link into your browser:<br>${escape(input.url)}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280">JobDraftly · Jobs in Pakistan</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: input.to, subject, text, html };
}
