// What this company calls its clients and projects (a property manager says "Properties").
// Read by the nav and the page headings; set in Settings.

import { queryOne } from "./db";
import type { TaxLabel } from "./tax-label";

export type Labels = { client: string; project: string; tax: TaxLabel };

export async function getLabels(): Promise<Labels> {
  const row = await queryOne<{ client_label: string | null; project_label: string | null; tax_label: string | null }>(
    "SELECT client_label, project_label, tax_label FROM app_settings WHERE id = 1"
  );
  return { client: row?.client_label || "Clients", project: row?.project_label || "Projects", tax: row?.tax_label === "VAT" ? "VAT" : "IVA" };
}
