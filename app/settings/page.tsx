import { getAppSettings, listUsers, getClosedThroughYear } from "@/lib/actions/settings-actions";
import { requireAdmin } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";
import UsersPanel from "@/components/UsersPanel";
import YearCloseForm from "@/components/YearCloseForm";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [settings, users, closedThroughYear] = await Promise.all([getAppSettings(), listUsers(), getClosedThroughYear()]);
  const nextYearToClose = closedThroughYear != null ? closedThroughYear + 1 : settings.reporting_year;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-neutral-600">Company details, VAT rates, and user accounts.</p>
      </div>

      <SettingsForm initial={settings} />

      <YearCloseForm closedThroughYear={closedThroughYear} nextYearToClose={nextYearToClose} />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary">Users</h2>
        <UsersPanel users={users} currentUserId={session.id} />
      </div>
    </div>
  );
}
