import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import type { Company } from "@/lib/companies";
import { multiCompany } from "@/lib/company-cookie";
import { SECTIONS, MENU_GROUPS } from "@/lib/sections";
import type { Labels } from "@/lib/labels";
import { logoutAction } from "@/lib/actions/auth-actions";
import { getAvailableReportingYears } from "@/lib/actions/dashboard-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import ReportingYearSelector from "@/components/ReportingYearSelector";

export default async function Nav({ user, company, allowed, labels }: { user: SessionUser; company?: Company; allowed: string[] | null; labels: Labels }) {
  // Menu groups as in the Excel main menu. Settings (admin only) belongs to the Admin group, first.
  const visible = SECTIONS.filter((s) => !allowed || allowed.includes(s.key)).map((s) => ({
    href: s.href,
    group: s.group,
    label: s.key === "customers" ? labels.client : s.key === "projects" ? labels.project : s.label,
  }));
  if (user.role === "ADMIN") visible.unshift({ href: "/settings", group: "Admin", label: "Settings" });
  const groups = MENU_GROUPS.map((g) => ({ name: g, links: visible.filter((l) => l.group === g) })).filter((g) => g.links.length > 0);
  const [years, effectiveYear, closedThroughYear] = await Promise.all([
    getAvailableReportingYears(),
    getEffectiveReportingYear(),
    getClosedThroughYear(),
  ]);
  return (
    <header className="fixed inset-y-0 left-0 z-40 flex print:hidden w-56 flex-col overflow-y-auto bg-primary text-white shadow-[14px_0_34px_-6px_rgba(0,0,0,0.42)]">
      <div className="px-5 py-5">
        <Link href="/" className="text-lg font-semibold leading-tight hover:text-white/80">
          Accounts Manager
        </Link>
        <span className="ml-2 text-xs text-white/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        {company && (
          <div className="mt-2 flex items-center gap-2 border-t border-white/15 pt-2 text-sm font-medium text-white">
            {company.name}
            {company.test && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Test</span>}
          </div>
        )}
      </div>
      <ReportingYearSelector years={years} effectiveYear={effectiveYear} closedThroughYear={closedThroughYear} />
      <nav className="flex flex-1 flex-col gap-4 px-3 pb-4">
        {groups.map((g) => (
          <div key={g.name} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">{g.name}</span>
            {g.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-white/15 px-4 py-4 text-sm text-white/80">
        <span>
          {user.name} <span className="text-white/50">({user.role === "ADMIN" ? "Admin" : "User"})</span>
        </span>
        {user.id > 0 && (
          <Link href="/account" className="rounded-md border border-white/30 px-3 py-1.5 text-center hover:bg-white/10">
            My account
          </Link>
        )}
        {multiCompany() && (
          <Link href="/companies" className="rounded-md border border-white/30 px-3 py-1.5 text-center hover:bg-white/10">
            Switch company
          </Link>
        )}
        <form action={logoutAction}>
          <button type="submit" className="w-full rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
