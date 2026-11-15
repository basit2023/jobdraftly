import { adminSetEmployerActiveAction, adminSetupLinkAction, createCompanyLoginAction } from "@/app/admin/employer-actions";
import { ConfirmSubmitButton } from "@/components/admin/form-controls";
import { LinkActionForm } from "@/components/employer/form-bits";
import { db } from "@/lib/db";

const input = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-blue-400";

function day(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(value) : null;
}

/** Admin panel: who can sign in to /employer for this company. */
export async function CompanyLogins({ companyId, companyName, isVerified }: { companyId: string; companyName: string; isVerified: boolean }) {
  const [users, applications] = await Promise.all([
    db.employerUser.findMany({
      where: { companyId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true, lastLoginAt: true },
    }),
    db.jobApplication.count({ where: { companyId } }),
  ]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0b1f3a]">Company logins</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            People listed here sign in at <span className="font-mono">/employer/login</span> to post {companyName}&apos;s jobs and review applicants ({applications} so far).
            {isVerified ? " This company is verified, so its jobs go live immediately." : " This company is not verified, so its jobs wait for approval in Jobs → Pending review. Tick “Verified” above to let them publish directly."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {users.length ? (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {users.map((user) => (
                <li className="p-4" key={user.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{user.name} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{user.role === "OWNER" ? "Owner" : "Recruiter"}</span></p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {!user.isActive ? "Switched off" : !user.passwordHash ? "Waiting for them to verify their email" : user.lastLoginAt ? `Verified · last signed in ${day(user.lastLoginAt)}` : "Verified, never signed in"}
                      </p>
                    </div>
                    <form action={adminSetEmployerActiveAction.bind(null, user.id, !user.isActive)}>
                      <ConfirmSubmitButton
                        label={user.isActive ? "Switch off" : "Switch on"}
                        message={user.isActive ? `Switch off ${user.email}? They are signed out immediately.` : `Allow ${user.email} to sign in again?`}
                        tone={user.isActive ? "danger" : "neutral"}
                      />
                    </form>
                  </div>
                  {user.isActive ? <LinkActionForm action={adminSetupLinkAction.bind(null, user.id)} className="mt-2" submitLabel={user.passwordHash ? "Send password reset email" : "Resend verification email"} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No logins yet. Create the owner&apos;s login to give this company access.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-extrabold text-[#0b1f3a]">Create a login</h3>
          <LinkActionForm action={createCompanyLoginAction.bind(null, companyId)} className="mt-3" submitLabel="Create login and send email">
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Name</span><input className={input} maxLength={120} name="name" required /></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Work email</span><input className={input} maxLength={191} name="email" required type="email" /></label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">Role</span>
                <select className={input} defaultValue={users.some((user) => user.role === "OWNER") ? "RECRUITER" : "OWNER"} name="role">
                  <option value="OWNER">Owner — manages team and profile</option>
                  <option value="RECRUITER">Recruiter — jobs and applicants</option>
                </select>
              </label>
            </div>
          </LinkActionForm>
        </div>
      </div>
    </section>
  );
}
