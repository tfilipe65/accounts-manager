import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import type { Company } from "@/lib/companies";
import { SECTIONS, MENU_GROUPS } from "@/lib/sections";
import type { Labels } from "@/lib/labels";
import { taxify } from "@/lib/tax-label";
import { logoutAction } from "@/lib/actions/auth-actions";
import { getAvailableReportingYears } from "@/lib/actions/dashboard-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import ReportingYearSelector from "@/components/ReportingYearSelector";
import NavMenu from "@/components/NavMenu";

export default async function Nav({ user, company, allowed, labels }: { user: SessionUser; company?: Company; allowed: string[] | null; labels: Labels }) {
  // Menu groups as in the Excel main menu. Settings (admin only) belongs to the Admin group, first.
  const visible = SECTIONS.filter((s) => (!allowed || allowed.includes(s.key)) && (!s.adminOnly || user.role === "ADMIN")).map((s) => ({
    href: s.href,
    group: s.group,
    label: s.key === "customers" ? labels.client : s.key === "projects" ? labels.project : taxify(s.label, labels.tax),
  }));
  if (user.role === "ADMIN") visible.unshift({ href: "/settings", group: "Admin", label: "Settings" });
  const groups = MENU_GROUPS.map((g) => ({ name: g, links: visible.filter((l) => l.group === g) })).filter((g) => g.links.length > 0);
  const [years, effectiveYear, closedThroughYear] = await Promise.all([
    getAvailableReportingYears(),
    getEffectiveReportingYear(),
    getClosedThroughYear(),
  ]);
  return (
    <>
      {/* Always visible: which app, which company, which year, who. */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-4 whitespace-nowrap bg-primary-dark px-4 text-white shadow-md print:hidden">
        <Link href="/" className="text-xl font-semibold hover:text-white/80">
          Accounts Manager
        </Link>
        <span className="-ml-2 text-sm text-white/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
        {company && (
          <div className="flex items-center gap-2 border-l border-white/20 pl-4 text-xl font-semibold">
            {company.name}
            {company.test && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Test</span>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-5">
          <ReportingYearSelector years={years} effectiveYear={effectiveYear} closedThroughYear={closedThroughYear} />
          <span className="hidden text-base text-white/80 md:inline">
            {user.name} <span className="text-white/50">({user.role === "ADMIN" ? "Admin" : "User"})</span>
          </span>
        </div>
      </div>

      <header className="fixed bottom-0 left-0 top-12 z-40 flex w-56 flex-col bg-primary text-white shadow-[14px_0_34px_-6px_rgba(0,0,0,0.42)] print:hidden">
        <div className="flex-1 overflow-y-auto pt-3">
          <NavMenu groups={groups} />
        </div>
        <div className="flex flex-col gap-2 border-t border-white/15 px-4 py-3 text-sm text-white/80">
          {user.id > 0 && (
            <Link href="/account" className="rounded-md border border-white/30 px-3 py-1.5 text-center hover:bg-white/10">
              My account
            </Link>
          )}
          <Link href="/companies" className="rounded-md border border-white/30 px-3 py-1.5 text-center hover:bg-white/10">
            Switch company
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10">
              Log out
            </button>
          </form>
        </div>
      </header>
    </>
  );
}
