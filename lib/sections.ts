// The areas of the app a user can be given or denied, and how the menu groups them -- the same
// groups as the Excel workbook's main menu: Admin, Master Data, Transactions, Data Analysis, Reports.
// Admins see everything; a USER with no restriction set (permissions NULL) sees everything too -- the
// admin narrows it in Settings > Logins. Settings itself is admin-only and sits in the Admin group.

export const MENU_GROUPS = ["Admin", "Master data", "Transactions", "Data analysis", "Reports"] as const;
export type MenuGroup = (typeof MENU_GROUPS)[number];

// adminOnly: only administrators see and open it, whatever a user's permissions say.
export const SECTIONS: { key: string; href: string; label: string; group: MenuGroup; adminOnly?: boolean }[] = [
  // Admin
  { key: "chart-of-accounts", href: "/chart-of-accounts", label: "Chart of Accounts", group: "Admin", adminOnly: true },
  { key: "checks", href: "/checks", label: "Checks", group: "Admin", adminOnly: true },
  // Master data
  { key: "customers", href: "/customers", label: "Clients", group: "Master data" },
  { key: "suppliers", href: "/suppliers", label: "Suppliers", group: "Master data" },
  { key: "employees", href: "/employees", label: "Employees", group: "Master data" },
  { key: "products-services", href: "/products-services", label: "Products & Services", group: "Master data" },
  { key: "projects", href: "/projects", label: "Projects", group: "Master data" },
  // Transactions
  { key: "income", href: "/income", label: "Income", group: "Transactions" },
  { key: "expense", href: "/expense", label: "Expenses", group: "Transactions" },
  { key: "banking", href: "/banking", label: "Banks & Cash", group: "Transactions" },
  { key: "journal", href: "/journal", label: "Journal Entries", group: "Transactions" },
  { key: "year-end-stock", href: "/year-end-stock", label: "Year-End Stock", group: "Transactions" },
  { key: "opening-balance", href: "/opening-balance", label: "Opening Balances", group: "Transactions" },
  // Data analysis
  { key: "dashboard", href: "/", label: "Dashboard", group: "Data analysis" },
  { key: "summary", href: "/summary", label: "Summary", group: "Data analysis" },
  { key: "trial-balance", href: "/trial-balance", label: "Trial Balance", group: "Data analysis" },
  { key: "profit-and-loss", href: "/profit-and-loss", label: "Profit & Loss", group: "Data analysis" },
  { key: "income-statement", href: "/income-statement", label: "Income Statement", group: "Data analysis" },
  { key: "balance-sheet", href: "/balance-sheet", label: "Balance Sheet", group: "Data analysis" },
  { key: "ageing", href: "/ageing", label: "Ageing", group: "Data analysis" },
  { key: "project-report", href: "/project-report", label: "Project Report", group: "Data analysis" },
  { key: "top10", href: "/top10", label: "Top 10s", group: "Data analysis" },
  // Reports
  { key: "vat-report", href: "/vat-report", label: "IVA Report", group: "Reports" },
  { key: "reports", href: "/reports", label: "Inc / Exp Report", group: "Reports" },
];

/** The sections an administrator can give or take away from a user (the admin-only ones are not theirs to give). */
export const PERMISSION_SECTIONS = SECTIONS.filter((s) => !s.adminOnly);

export function isAdminOnlySection(key: string): boolean {
  return SECTIONS.some((s) => s.key === key && s.adminOnly);
}

/** Which section a URL path belongs to, or null for pages outside the permission list (settings, login, ...). */
export function sectionForPath(pathname: string): string | null {
  const first = pathname.split("/")[1] ?? "";
  if (first === "") return "dashboard";
  return SECTIONS.some((s) => s.key === first) ? first : null;
}
