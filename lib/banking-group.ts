// The register shows one line per bank-statement line. The parts of a split transaction share a split_id and
// are shown together under one heading. Plain functions so the server page and a client component can both use them.

import type { BankTransactionRow } from "@/lib/actions/banking-actions";
import type { SplitInput } from "@/lib/actions/split-actions";

/** Separates the split's own description from a part's note in the stored description. */
export const SPLIT_SEPARATOR = " — ";

export type RegisterItem =
  | { type: "row"; row: BankTransactionRow }
  | {
      type: "split";
      splitId: string;
      rows: BankTransactionRow[];
      date: string;
      description: string;
      /** What the statement line moved: positive in, negative out. */
      net: number;
      reconciled: boolean;
    };

const movement = (r: BankTransactionRow) => r.in_amount + r.in_vat - r.out_amount - r.out_vat;

export function groupRegister(rows: BankTransactionRow[]): RegisterItem[] {
  const items: RegisterItem[] = [];
  const open = new Map<string, Extract<RegisterItem, { type: "split" }>>();
  for (const row of rows) {
    if (!row.split_id) {
      items.push({ type: "row", row });
      continue;
    }
    let group = open.get(row.split_id);
    if (!group) {
      group = {
        type: "split",
        splitId: row.split_id,
        rows: [],
        date: row.payment_date,
        description: (row.description ?? "").split(SPLIT_SEPARATOR)[0],
        net: 0,
        reconciled: true,
      };
      open.set(row.split_id, group);
      items.push(group);
    }
    group.rows.push(row);
    group.net += movement(row);
    if (!row.reconciled) group.reconciled = false;
  }
  return items;
}

/** What the part says on its own (the stored description minus the split's heading). */
export function partNote(row: BankTransactionRow): string {
  const bits = (row.description ?? "").split(SPLIT_SEPARATOR);
  return bits.slice(1).join(SPLIT_SEPARATOR);
}

/** The form's starting values for editing a split. */
export function splitInputFromRows(bankAccountId: number, rows: BankTransactionRow[]): SplitInput {
  const net = rows.reduce((s, r) => s + movement(r), 0);
  const direction: "in" | "out" = net > 0 ? "in" : "out";
  const sign = direction === "in" ? 1 : -1;
  const lines = rows.map((r) => {
    const kind: "account" | "sales" | "purchase" | "none" = r.sales_invoice_id ? "sales" : r.purchase_invoice_id ? "purchase" : r.account_no ? "account" : "none";
    return {
      kind,
      account_no: kind === "account" ? r.account_no : null,
      sales_invoice_id: r.sales_invoice_id,
      purchase_invoice_id: r.purchase_invoice_id,
      employee_id: kind === "account" ? r.employee_id : null,
      description: partNote(r) || null,
      amount: Math.round(sign * movement(r) * 100) / 100,
      vat_perc: kind === "account" && r.vat_perc != null ? r.vat_perc : 0,
    };
  });
  return {
    bank_account_id: bankAccountId,
    payment_date: rows[0].payment_date,
    description: (rows[0].description ?? "").split(SPLIT_SEPARATOR)[0] || null,
    direction,
    total: Math.round(Math.abs(net) * 100) / 100,
    lines,
  };
}
