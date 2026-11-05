// The areas of the app a user can be given or denied. Admins see everything; a USER with no
// restriction set (permissions NULL) sees everything too -- the admin narrows it in Settings > Users.
// Settings itself is admin-only and not listed here.

export const SECTIONS: { key: string; href: string; label: string }[] = [
  { key: "dashboard", href: "/", label: "Dashboard" },
  { key: "chart-of-accounts", href: "/chart-of-accounts", label: "Chart of Accounts" },
  { key: "customers", href: "/customers", label: "Customers" },
  { key: "suppliers", href: "/suppliers", label: "Suppliers" },
  { key: "products-services", href: "/products-services", label: "Products & Services" },
  { key: "projects", href: "/projects", label: "Projects" },
  { key: "income", href: "/income", label: "Income" },
  { key: "expense", href: "/expense", label: "Expense" },
  { key: "banking", href: "/banking", label: "Banking & Cash" },
  { key: "journal", href: "/journal", label: "Journal Entries" },
  { key: "opening-balance", href: "/opening-balance", label: "Opening Balance" },
  { key: "trial-balance", href: "/trial-balance", label: "Trial Balance" },
  { key: "profit-and-loss", href: "/profit-and-loss", label: "Profit & Loss" },
  { key: "vat-report", href: "/vat-report", label: "VAT Report" },
  { key: "ageing", href: "/ageing", label: "Ageing" },
  { key: "project-report", href: "/project-report", label: "Project Report" },
  { key: "top10", href: "/top10", label: "Top 10s" },
];

/** Which section a URL path belongs to, or null for pages outside the permission list (settings, login, ...). */
export function sectionForPath(pathname: string): string | null {
  const first = pathname.split("/")[1] ?? "";
  if (first === "") return "dashboard";
  return SECTIONS.some((s) => s.key === first) ? first : null;
}
