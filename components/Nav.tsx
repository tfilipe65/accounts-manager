import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth-actions";
import { getAvailableReportingYears } from "@/lib/actions/dashboard-actions";
import { getEffectiveReportingYear } from "@/lib/reporting-year";
import { getClosedThroughYear } from "@/lib/year-close";
import ReportingYearSelector from "@/components/ReportingYearSelector";

const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/products-services", label: "Products & Services" },
  { href: "/projects", label: "Projects" },
  { href: "/income", label: "Income" },
  { href: "/expense", label: "Expense" },
  { href: "/banking", label: "Banking & Cash" },
  { href: "/journal", label: "Journal Entries" },
  { href: "/opening-balance", label: "Opening Balance" },
  { href: "/trial-balance", label: "Trial Balance" },
  { href: "/profit-and-loss", label: "Profit & Loss" },
  { href: "/vat-report", label: "VAT Report" },
  { href: "/ageing", label: "Ageing" },
  { href: "/project-report", label: "Project Report" },
  { href: "/top10", label: "Top 10s" },
  { href: "/settings", label: "Settings", adminOnly: true },
];

export default async function Nav({ user }: { user: SessionUser }) {
  const links = LINKS.filter((l) => !l.adminOnly || user.role === "ADMIN");
  const [years, effectiveYear, closedThroughYear] = await Promise.all([
    getAvailableReportingYears(),
    getEffectiveReportingYear(),
    getClosedThroughYear(),
  ]);
  return (
    <header className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-y-auto bg-primary text-white shadow-[14px_0_34px_-6px_rgba(0,0,0,0.42)]">
      <div className="px-5 py-5">
        <span className="text-lg font-semibold leading-tight">Accounts Manager</span>
        <span className="ml-2 text-xs text-white/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </div>
      <ReportingYearSelector years={years} effectiveYear={effectiveYear} closedThroughYear={closedThroughYear} />
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-white/15 px-4 py-4 text-sm text-white/80">
        <span>
          {user.name} <span className="text-white/50">({user.role === "ADMIN" ? "Admin" : "User"})</span>
        </span>
        <form action={logoutAction}>
          <button type="submit" className="w-full rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
