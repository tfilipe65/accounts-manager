// The list of companies this PC holds. Each one is a separate database under
// <data dir>\companies\<slug>\db, with its own users, chart of accounts and transactions.
// The list itself is <data dir>\companies.json; the first start writes the default set below.

import fs from "fs";
import path from "path";
import { dataDir } from "./data-dir";

/** The chart of accounts a company starts from: C Construction, W Carpentry, I Decorations, P Property management, K Client money account. */
export type ChartTemplate = "C" | "W" | "I" | "P" | "K";
export const CHART_TEMPLATES: { value: ChartTemplate; label: string }[] = [
  { value: "C", label: "Construction" },
  { value: "W", label: "Carpentry and workshop" },
  { value: "I", label: "Decorations and design" },
  { value: "P", label: "Property management and rentals" },
  { value: "K", label: "Client money account" },
];
const TEMPLATE_BY_SLUG: Record<string, ChartTemplate> = {
  "teia-firme": "C",
  woodgrain: "W",
  "algarve-interior": "I",
  "casas-algarve": "P",
  "casas-algarve-clients": "K",
  test: "C",
};

export type Company = { slug: string; name: string; description: string; test?: boolean; template?: ChartTemplate };

export const companyTemplate = (c: Company): ChartTemplate => c.template ?? TEMPLATE_BY_SLUG[c.slug] ?? "C";

const DEFAULT_COMPANIES: Company[] = [
  { slug: "teia-firme", name: "Teia Firme", description: "Construction" },
  { slug: "woodgrain", name: "Woodgrain", description: "Carpentry" },
  { slug: "algarve-interior", name: "Algarve Interior", description: "Decorations" },
  { slug: "casas-algarve", name: "Casas Algarve", description: "Property management & rentals" },
  { slug: "casas-algarve-clients", name: "Casas Algarve - Client Account", description: "Money held on behalf of property-management clients" },
  { slug: "test", name: "Test", description: "Practice company", test: true },
];

declare global {
  var __companies__: Company[] | undefined;
}

const registryFile = () => path.join(dataDir(), "companies.json");

export const companyDbDir = (slug: string) => path.join(dataDir(), "companies", slug, "db");

function save(list: Company[]): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(registryFile(), JSON.stringify(list, null, 2), "utf8");
  global.__companies__ = list;
}

// Before there were companies the app had one database at <data dir>\db. It held the workbook data
// that is now the Test company, so move it there the first time the list is created.
function adoptSingleCompanyDatabase(): void {
  const legacy = path.join(dataDir(), "db");
  const target = companyDbDir("test");
  if (fs.existsSync(legacy) && !fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(legacy, target);
  }
}

export function listCompanies(): Company[] {
  if (global.__companies__) return global.__companies__;
  try {
    const parsed = JSON.parse(fs.readFileSync(registryFile(), "utf8"));
    if (Array.isArray(parsed)) return (global.__companies__ = parsed as Company[]);
  } catch {
    // no list yet
  }
  adoptSingleCompanyDatabase();
  save(DEFAULT_COMPANIES);
  return DEFAULT_COMPANIES;
}

export function getCompany(slug: string): Company | undefined {
  return listCompanies().find((c) => c.slug === slug);
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function addCompany(name: string, description: string, template: ChartTemplate = "C"): Company {
  const slug = slugify(name);
  if (!slug) throw new Error("Enter a company name.");
  if (getCompany(slug)) throw new Error(`There is already a company called "${name}".`);
  const company: Company = { slug, name: name.trim(), description: description.trim(), template };
  save([...listCompanies(), company]);
  return company;
}
