import { getAppSettings, listUsers, getClosedThroughYear, listAuditLog } from "@/lib/actions/settings-actions";
import { listAllAccountOptions } from "@/lib/actions/reference-actions";
import { requireAdmin } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/current-company";
import { backupsDir, listBackups } from "@/lib/backup";
import SettingsForm from "@/components/SettingsForm";
import UsersPanel from "@/components/UsersPanel";
import YearCloseForm from "@/components/YearCloseForm";
import BackupPanel from "@/components/BackupPanel";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [settings, users, closedThroughYear, accounts, audit] = await Promise.all([
    getAppSettings(),
    listUsers(),
    getClosedThroughYear(),
    listAllAccountOptions(),
    listAuditLog(100),
  ]);
  const company = await getCurrentCompany();
  const backups = company ? listBackups(company.slug) : [];
  const nextYearToClose = closedThroughYear != null ? closedThroughYear + 1 : settings.reporting_year;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-neutral-600">Company details, VAT rates, year-end, and logins.</p>
      </div>

      <SettingsForm initial={settings} accounts={accounts.filter((a) => a.normal_balance === "debit")} />

      <YearCloseForm closedThroughYear={closedThroughYear} nextYearToClose={nextYearToClose} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary">Backup</h2>
        <BackupPanel backups={backups} folder={company ? backupsDir(company.slug) : ""} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary">Logins</h2>
        <UsersPanel users={users} currentUserId={session.id} />
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold text-primary">Activity log</h2>
        <p className="mb-3 text-sm text-neutral-600">Sign-ins, failed and locked attempts, and changes to logins, bank accounts and settings. The latest 100.</p>
        <div className="max-h-96 overflow-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b border-line bg-background text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Who</th>
                <th className="px-4 py-2">What</th>
                <th className="px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-1.5 text-neutral-600">{when(a.at)}</td>
                  <td className="px-4 py-1.5">{a.username ?? "—"}</td>
                  <td className="px-4 py-1.5 font-medium">{a.action}</td>
                  <td className="px-4 py-1.5 text-neutral-600">{a.detail}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-neutral-500">
                    Nothing logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
