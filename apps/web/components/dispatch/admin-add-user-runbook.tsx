import { AGENCY_ASSIGNABLE_ROLES, ROLE_DISPLAY_LABELS } from "rapid-cortex-shared";

/**
 * In-app runbook for agency admins (B1). Shown on Admin → Users.
 * Cognito create uses suppressed email; steps 7–8 describe agency delivery practice.
 */
export function AdminAddUserRunbook() {
  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-4 md:p-5">
      <h2 className="text-base font-semibold text-white">B1. Create a new user account</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
        Add a dispatcher, supervisor, analyst, or staff member to your agency using{" "}
        <span className="text-slate-300">Admin → Users</span> and the form below.
      </p>

      <div className="mt-4 overflow-x-auto rounded-md border border-slate-800">
        <table className="min-w-[520px] w-full text-left text-xs text-slate-300">
          <caption className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Role reference (agency assignable)
          </caption>
          <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Label</th>
            </tr>
          </thead>
          <tbody>
            {AGENCY_ASSIGNABLE_ROLES.map((role) => (
              <tr key={role} className="border-b border-slate-800/80 last:border-0">
                <td className="px-3 py-2 font-mono text-slate-200">{role}</td>
                <td className="px-3 py-2">{ROLE_DISPLAY_LABELS[role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100/95">
        <span className="font-medium text-amber-50">Welcome email:</span> User creation from this admin API uses
        Cognito with messaging suppressed. Until automated welcome email is enabled,{" "}
        <span className="text-amber-50">you must deliver</span> the temporary password and sign-in link through your
        agency&apos;s approved secure channel (treat steps 7–8 as your runbook for that handoff). Use subject line
        such as <span className="font-mono text-amber-200/90">Your Rapid Cortex account is ready</span> if your
        process uses email.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
        <li>Log in at rapidcortex.us with your admin or it_admin credentials.</li>
        <li>
          Go to <span className="text-slate-200">Admin → Users</span> (this page).
        </li>
        <li>
          Enter the user&apos;s <span className="text-slate-200">work email address</span> — it becomes their
          username.
        </li>
        <li>
          Select their <span className="text-slate-200">role</span> from the role reference table above.
        </li>
        <li>
          Confirm <span className="text-slate-200">Agency ID</span> matches your agency (agency admins can only create
          users for their own tenant).
        </li>
        <li>
          Click <span className="text-slate-200">Create User</span> after entering a strong temporary password (or use
          Generate).
        </li>
        <li>
          Provide the user their credentials and the sign-in link (e.g. rapidcortex.us or your jurisdiction URL) via
          your secure channel.
        </li>
        <li>
          If you email them, include the temporary password and login link; align with your agency security policy.
        </li>
        <li>
          Instruct the user to sign in before the temporary password expires (commonly within seven days — confirm your
          Cognito user pool password policy).
        </li>
        <li>
          On first login they must set a new password; enroll in MFA if your pool requires an authenticator app.
        </li>
        <li>Confirm with the user that they have successfully signed in before closing the ticket.</li>
      </ol>
    </section>
  );
}
