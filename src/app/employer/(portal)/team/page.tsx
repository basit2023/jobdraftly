import type { Metadata } from "next";

import { addTeamMemberAction, resetTeamMemberLinkAction, setTeamMemberActiveAction } from "@/app/employer/actions";
import { ConfirmSubmit, LinkActionForm } from "@/components/employer/form-bits";
import { Card, Field, formatDay, inputClass, PageTitle } from "@/components/employer/ui";
import { requireEmployer } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Team" };

export default async function EmployerTeamPage() {
  const employer = await requireEmployer(["OWNER"]);
  const members = await db.employerUser.findMany({
    where: { companyId: employer.companyId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true, setupTokenExpiresAt: true, lastLoginAt: true },
  });

  return (
    <>
      <PageTitle description="Everyone here can post jobs and review applicants. Only owners can change the company profile and the team." title="Team" />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title={`${members.length} ${members.length === 1 ? "person" : "people"}`}>
          <ul className="-my-3 divide-y divide-line">
            {members.map((member) => {
              const pendingSetup = !member.passwordHash;
              return (
                <li className="py-3.5" key={member.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {member.name}
                        {member.id === employer.userId ? <span className="text-muted"> (you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                      <p className="mt-1 text-xs text-muted">
                        {member.role === "OWNER" ? "Owner" : "Recruiter"} ·{" "}
                        {!member.isActive ? "Switched off" : pendingSetup ? "Waiting for them to verify their email" : member.lastLoginAt ? `Last signed in ${formatDay(member.lastLoginAt)}` : "Never signed in"}
                      </p>
                    </div>
                    {member.id !== employer.userId ? (
                      <form action={setTeamMemberActiveAction.bind(null, member.id, !member.isActive)}>
                        <ConfirmSubmit
                          label={member.isActive ? "Switch off" : "Switch on"}
                          message={member.isActive ? `Switch off ${member.name}'s login? They'll be signed out straight away.` : `Let ${member.name} sign in again?`}
                          tone={member.isActive ? "danger" : "secondary"}
                        />
                      </form>
                    ) : null}
                  </div>
                  {member.isActive && member.id !== employer.userId ? (
                    <LinkActionForm action={resetTeamMemberLinkAction.bind(null, member.id)} className="mt-2" submitLabel={pendingSetup ? "Resend verification email" : "Send password reset email"} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Add a recruiter">
          <LinkActionForm action={addTeamMemberAction} submitLabel="Add and send email">
            <div className="space-y-4">
              <Field label="Name">
                <input className={inputClass} maxLength={120} name="name" required />
              </Field>
              <Field label="Work email">
                <input className={inputClass} maxLength={191} name="email" required type="email" />
              </Field>
            </div>
          </LinkActionForm>
          <p className="mt-4 text-xs leading-5 text-muted">We email them a link to verify their address and choose their own password; you never see it.</p>
        </Card>
      </div>
    </>
  );
}
